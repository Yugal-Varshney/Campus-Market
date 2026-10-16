'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/session';
import { moderateListing } from '@/lib/moderation';
import { friendlyDbError } from '@/lib/errors';
import { validateListing } from '@/lib/validation/listing';
import { getCategories } from '@/lib/categories';
import { removeImage, storagePathFromUrl, uploadListingImage } from './storage';
import { getSellerContact } from './queries';
import type { ActionState, ListingStatus, SellerContact } from '@/types';

/** Keeps the message and, when known, which input it belongs to, so the form can mark that input. */
const fail = (error?: string, field?: string): ActionState => ({ error, fieldErrors: field && error ? { [field]: error } : undefined });

const str = (fd: FormData, k: string) => (typeof fd.get(k) === 'string' ? (fd.get(k) as string) : '');

function readListing(fd: FormData, categories: string[]) {
  return validateListing({
    title: str(fd, 'title'),
    description: str(fd, 'description'),
    category: str(fd, 'category'),
    listingType: str(fd, 'listingType'),
    price: Number(str(fd, 'price')),
    condition: str(fd, 'condition'),
    phone: str(fd, 'phone'),
    rentUnit: str(fd, 'rentUnit'),
    rentMaxUnits: str(fd, 'rentMaxUnits'),
  }, categories);
}
const photo = (fd: FormData): File | null => {
  const f = fd.get('photo');
  return f instanceof File && f.size > 0 ? f : null;
};

export async function createListing(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in to continue.' };

  const categories = await getCategories();
  const { value, error, field } = readListing(fd, categories.map((c) => c.value));
  if (!value) return fail(error, field);
  const file = photo(fd);
  if (!file) return fail('Add a photo — real photos get far more replies.', 'photo');

  const verdict = await moderateListing(value);
  if (verdict.decision === 'reject') return { error: 'This listing cannot be posted.' };

  const up = await uploadListingImage(user.id, file);
  if (!up.url) return { error: up.error };

  const supabase = await createClient();
  // seller_id / seller_name / status / created_at are forced by the DB trigger, not by this payload.
  const { data: item, error: insertErr } = await supabase
    .from('items')
    .insert({
      title: value.title,
      description: value.description,
      category: value.category,
      listing_type: value.listingType,
      price: value.price,
      condition_label: value.condition,
      image_url: up.url,
      rent_unit: value.rentUnit,
      rent_max_units: value.rentMaxUnits,
    })
    .select('id')
    .single();
  if (insertErr || !item) {
    await removeImage(up.path ?? null);
    // Rate limits and account restrictions come back as coded messages (migrations 006/009).
    return { error: friendlyDbError(insertErr?.message, 'Could not post your listing. Please check the fields and try again.') };
  }

  const { error: privErr } = await supabase
    .from('item_private')
    .insert({ item_id: item.id, contact_phone: value.phone });
  if (privErr) {
    await supabase.from('items').delete().eq('id', item.id);
    await removeImage(up.path ?? null);
    return { error: friendlyDbError(privErr.message, 'Could not save your contact details. Please try again.') };
  }

  revalidatePath('/marketplace');
  redirect(`/marketplace/${item.id}?posted=1`);
}

export async function updateListing(id: number, _: ActionState, fd: FormData): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in to continue.' };
  const supabase = await createClient();
  const { data: current } = await supabase.from('items').select('image_url, status, seller_id, category').eq('id', id).maybeSingle();
  if (!current || current.seller_id !== user.id) return { error: 'Listing not found.' };
  if (current.status !== 'active') return { error: 'Mark the item available again before editing it.' };
  // The listing's own category stays valid even if an admin has since disabled it.
  const categories = await getCategories();
  const { value, error, field } = readListing(fd, [...categories.map((c) => c.value), current.category]);
  if (!value) return fail(error, field);

  let imageUrl: string | undefined;
  let newPath: string | undefined;
  const file = photo(fd);
  if (file) {
    const up = await uploadListingImage(user.id, file);
    if (!up.url) return { error: up.error };
    imageUrl = up.url;
    newPath = up.path;
  }

  const { error: upErr } = await supabase
    .from('items')
    .update({
      title: value.title,
      description: value.description,
      category: value.category,
      listing_type: value.listingType,
      price: value.price,
      condition_label: value.condition,
      rent_unit: value.rentUnit,
      rent_max_units: value.rentMaxUnits,
      ...(imageUrl ? { image_url: imageUrl } : {}),
    })
    .eq('id', id)
    .eq('seller_id', user.id);
  if (upErr) {
    await removeImage(newPath ?? null);
    return { error: friendlyDbError(upErr.message, 'Could not save your changes.') };
  }
  // The listing row is already saved at this point, so a phone-number failure must be reported
  // (it used to be ignored, which made phone edits fail silently).
  const { data: phoneRows, error: phoneErr } = await supabase
    .from('item_private')
    .update({ contact_phone: value.phone })
    .eq('item_id', id)
    .select('item_id');
  if (imageUrl) await removeImage(storagePathFromUrl(current.image_url, user.id));
  if (phoneErr || !phoneRows?.length) {
    revalidatePath('/marketplace');
    revalidatePath(`/marketplace/${id}`);
    return {
      error: friendlyDbError(
        phoneErr?.message,
        'Your listing was updated, but your phone number could not be saved. Please open Edit and try again.',
      ),
    };
  }

  revalidatePath('/marketplace');
  redirect(`/marketplace/${id}?updated=1`);
}

/** Status changes are enforced by RLS + CHECK constraints; this just reports the outcome. */
export async function setListingStatus(id: number, status: ListingStatus): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in to continue.' };
  // 'inactive' exists in the database (migration 006) but the app has no screen for it yet;
  // reject anything the UI never sends instead of trusting the client-supplied value.
  if (status !== 'active' && status !== 'sold' && status !== 'rented') return { error: 'That status is not allowed for this listing.' };
  const supabase = await createClient();
  const { data, error } = await supabase.from('items').update({ status }).eq('id', id).select('id');
  if (error) return { error: friendlyDbError(error.message, 'That status is not allowed for this listing.') };
  if (!data?.length) return { error: "You can't change this listing. Only the seller can, and the account must be in good standing." };
  revalidatePath('/marketplace');
  revalidatePath(`/marketplace/${id}`);
  return { success: 'Listing updated.' };
}

export async function deleteListing(id: number): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in to continue.' };
  const supabase = await createClient();
  const { data: row } = await supabase.from('items').select('image_url').eq('id', id).eq('seller_id', user.id).maybeSingle();
  if (!row) return { error: 'Listing not found.' };
  const { data, error } = await supabase.from('items').delete().eq('id', id).select('id');
  // The database refuses to delete a listing that has conversations (restrict_violation 23001).
  if (error?.code === '23001' || /conversations/i.test(error?.message ?? ''))
    return { error: "This listing has conversations, so it can't be deleted. Mark it as sold or rented instead — your chats stay intact." };
  if (error || !data?.length) return { error: friendlyDbError(error?.message, 'Could not delete this listing.') };
  await removeImage(storagePathFromUrl(row.image_url, user.id));
  revalidatePath('/marketplace');
  redirect('/marketplace');
}

export async function toggleWishlist(itemId: number, saved: boolean): Promise<ActionState> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in to continue.' };
  const supabase = await createClient();
  const { error } = saved
    ? await supabase.from('wishlists').upsert({ user_id: user.id, item_id: itemId }, { onConflict: 'user_id,item_id', ignoreDuplicates: true })
    : await supabase.from('wishlists').delete().eq('item_id', itemId).eq('user_id', user.id);
  if (error) return { error: friendlyDbError(error.message, 'Could not update your wishlist.') };
  revalidatePath('/wishlist');
  return {};
}

export async function revealContact(itemId: number): Promise<{ contact?: SellerContact; error?: string }> {
  const user = await getCurrentUser();
  if (!user) return { error: 'You need to sign in to continue.' };
  const res = await getSellerContact(itemId);
  return 'error' in res ? { error: res.error } : { contact: res };
}
