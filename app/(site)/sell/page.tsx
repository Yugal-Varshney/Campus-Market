import type { Metadata } from 'next';
import ListingForm from '@/components/forms/ListingForm';
import { createListing } from '@/lib/listings/actions';
import { getCategories } from '@/lib/categories';

export const metadata: Metadata = { title: 'Sell or rent an item' };

export default async function SellPage() {
  const categories = await getCategories();
  return (
    <div className="sell-shell">
      <h1 className="font-display">PIN A LISTING</h1>
      <p className="lead">Post it for your campus in under a minute.</p>
      <ListingForm action={createListing} submitLabel="POST LISTING" categories={categories} />
    </div>
  );
}
