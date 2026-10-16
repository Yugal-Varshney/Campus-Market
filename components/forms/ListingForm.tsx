'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import { CONDITIONS, MAX_PRICE, RENT_UNITS, categoryLabel, conditionLabel } from '@/lib/constants';
import { formatPrice, rentTerms, statusInfo } from '@/lib/format';
import { compressImage } from '@/lib/image-compress';
import { validateImageMeta, validateListing } from '@/lib/validation/listing';
import type { ActionState, CategoryOption, ListingType, RentUnit } from '@/types';

export interface ListingFormInitial {
  title: string; description: string; category: string; listingType: ListingType;
  price: number; condition: string; phone: string; imageUrl: string | null;
  rentUnit: RentUnit | null; rentMaxUnits: number | null;
}
type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

const TITLE_MAX = 120;
const DESC_MAX = 1000;

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={`err-${id}`} className="field-error" role="alert">{message}</p> : null;
}

export default function ListingForm({ action, initial, submitLabel, categories, sellerName = 'You' }: { action: Action; initial?: ListingFormInitial; submitLabel: string; categories: CategoryOption[]; sellerName?: string }) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const [mode, setMode] = useState<ListingType>(initial?.listingType ?? 'sell');
  const [rentUnit, setRentUnit] = useState<RentUnit>(initial?.rentUnit ?? 'week');
  const unitInfo = RENT_UNITS.find((u) => u.value === rentUnit) ?? RENT_UNITS[1];
  const [preview, setPreview] = useState<string | null>(initial?.imageUrl ?? null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [clientErrors, setClientErrors] = useState<Record<string, string>>({});
  const [vals, setVals] = useState({
    title: initial?.title ?? '', description: initial?.description ?? '', price: initial ? String(initial.price) : '',
    condition: initial?.condition ?? 'good', category: initial?.category ?? 'books', rentMax: initial?.rentMaxUnits ? String(initial.rentMaxUnits) : '',
  });
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const blobRef = useRef<string | null>(null);
  const editing = !!initial;

  // Errors from the server (for example a rate limit) show next to their field when we know which one it is.
  const errors = { ...(state.fieldErrors ?? {}), ...clientErrors };
  const generalError = clientErrors._ || (state.error && !Object.keys(state.fieldErrors ?? {}).length ? state.error : '');
  const bad = (name: string) => (errors[name] ? { 'aria-invalid': true as const, 'aria-describedby': `err-${name}` } : {});

  useEffect(() => () => { if (blobRef.current) URL.revokeObjectURL(blobRef.current); }, []);

  function setPhotoPreview(url: string | null, isBlob: boolean) {
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    blobRef.current = isBlob ? url : null;
    setPreview(url);
  }

  async function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const original = input.files?.[0];
    if (!original) return;
    setPhotoBusy(true);
    try {
      const file = await compressImage(original);
      const problem = validateImageMeta(file);
      if (problem) { setClientErrors((c) => ({ ...c, photo: problem })); input.value = ''; setPhotoPreview(initial?.imageUrl ?? null, false); return; }
      setClientErrors((c) => ({ ...c, photo: '' }));
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      setPhotoPreview(URL.createObjectURL(file), true);
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto() {
    if (fileRef.current) fileRef.current.value = '';
    setPhotoPreview(initial?.imageUrl ?? null, false);
  }

  // Keep the live preview and the character counters in step with what is typed.
  function onInput(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    setVals({
      title: String(fd.get('title') ?? ''), description: String(fd.get('description') ?? ''), price: String(fd.get('price') ?? ''),
      condition: String(fd.get('condition') ?? 'good'), category: String(fd.get('category') ?? ''), rentMax: String(fd.get('rentMaxUnits') ?? ''),
    });
    const name = (e.target as HTMLInputElement).name;
    if (name && errors[name]) setClientErrors((c) => ({ ...c, [name]: '' })); // an empty string hides a server-side message too
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    const fd = new FormData(e.currentTarget);
    const { error, field } = validateListing({
      title: String(fd.get('title') ?? ''), description: String(fd.get('description') ?? ''),
      category: String(fd.get('category') ?? ''), listingType: mode,
      price: Number(fd.get('price')), condition: String(fd.get('condition') ?? ''), phone: String(fd.get('phone') ?? ''),
      rentUnit: String(fd.get('rentUnit') ?? ''), rentMaxUnits: String(fd.get('rentMaxUnits') ?? ''),
    }, categories.map((c) => c.value));
    const photo = fd.get('photo');
    const hasPhoto = photo instanceof File && photo.size > 0;
    let target = field ?? '';
    let msg = error ?? '';
    if (!msg && !editing && !hasPhoto) { msg = 'Add a photo — real photos get far more replies.'; target = 'photo'; }
    if (!msg) { setClientErrors({}); return; }
    e.preventDefault();
    setClientErrors({ [target || '_']: msg });
    // Move focus to the field that needs fixing so keyboard and screen-reader users land on it.
    const el = target === 'photo' ? document.getElementById('sell-photo-trigger') : target ? formRef.current?.elements.namedItem(target) : null;
    if (el instanceof HTMLElement) el.focus();
  }

  // ---- values for the live preview ----
  const priceNum = Number(vals.price);
  const previewTerms = rentTerms({ listingType: mode, rentUnit: mode === 'rent' ? rentUnit : null, rentMaxUnits: vals.rentMax && Number(vals.rentMax) > 0 ? Number(vals.rentMax) : null });
  const previewStatus = statusInfo({ status: 'active', listingType: mode });
  const catLabel = categoryLabel(vals.category, Object.fromEntries(categories.map((c) => [c.value, c.label])));

  return (
    <form ref={formRef} action={formAction} onSubmit={onSubmit} onInput={onInput} className="sell-grid" noValidate>
      <div className="sell-form-col">
        <fieldset style={{ border: 0, padding: 0 }}>
          <legend className="field-label">Is this item for sale or for rent?</legend>
          <input type="hidden" name="listingType" value={mode} />
          <div className="mode-toggle">
            {(['sell', 'rent'] as const).map((m) => (
              <button key={m} type="button" className={`mode-btn${mode === m ? ' active' : ''}`} aria-pressed={mode === m} onClick={() => setMode(m)}>
                {m === 'sell' ? 'FOR SALE' : 'FOR RENT'}
              </button>
            ))}
          </div>
        </fieldset>
        <div>
          <label className="field-label" htmlFor="sell-title">Title</label>
          <input id="sell-title" name="title" className="field-input" defaultValue={initial?.title} placeholder="e.g. Organic Chemistry 3rd Ed — highlighted" maxLength={TITLE_MAX} autoComplete="off" {...bad('title')} />
          <div className="field-meta">
            <FieldError id="title" message={errors.title} />
            <span className="field-count" aria-hidden="true">{vals.title.length}/{TITLE_MAX}</span>
          </div>
          <p className="field-hint">Name the item, edition or model, and anything that sets it apart.</p>
        </div>
        <div>
          <label className="field-label" htmlFor="sell-description">Description</label>
          <textarea id="sell-description" name="description" className="field-input" rows={4} maxLength={DESC_MAX} defaultValue={initial?.description} placeholder="Condition details, what's included, pickup spot on campus…" {...bad('description')} />
          <div className="field-meta">
            <FieldError id="description" message={errors.description} />
            <span className="field-count" aria-hidden="true">{vals.description.length}/{DESC_MAX}</span>
          </div>
        </div>
        <div className="field-row-2">
          <div>
            <label className="field-label" htmlFor="sell-price">{mode === 'rent' ? `Price per ${unitInfo.label.toLowerCase()}` : 'Price'}</label>
            <div className="price-input-wrap">
              <span className="dollar" aria-hidden="true">₹</span>
              <input id="sell-price" name="price" type="number" inputMode="decimal" className="field-input" defaultValue={initial?.price} placeholder="250" min={1} max={MAX_PRICE} step="1" {...bad('price')} />
            </div>
            <FieldError id="price" message={errors.price} />
          </div>
          <div>
            <label className="field-label" htmlFor="sell-condition">Condition</label>
            <select id="sell-condition" name="condition" className="field-input" defaultValue={initial?.condition ?? 'good'} {...bad('condition')}>
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <FieldError id="condition" message={errors.condition} />
          </div>
        </div>
        {mode === 'rent' && (
          <div className="field-row-2">
            <div>
              <label className="field-label" htmlFor="sell-rent-unit">Rent is charged per</label>
              <select id="sell-rent-unit" name="rentUnit" className="field-input" value={rentUnit} onChange={(e) => setRentUnit(e.target.value as RentUnit)} {...bad('rentUnit')}>
                {RENT_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
              <FieldError id="rentUnit" message={errors.rentUnit} />
            </div>
            <div>
              <label className="field-label" htmlFor="sell-rent-max">Longest rental (optional)</label>
              <input id="sell-rent-max" name="rentMaxUnits" type="number" inputMode="numeric" className="field-input" defaultValue={initial?.rentMaxUnits ?? ''} min={1} max={unitInfo.max} step="1" placeholder={`e.g. 4 (${unitInfo.plural})`} {...bad('rentMaxUnits')} />
              <FieldError id="rentMaxUnits" message={errors.rentMaxUnits} />
            </div>
          </div>
        )}
        <div className="field-row-2">
          <div>
            <label className="field-label" htmlFor="sell-category">Category</label>
            <select id="sell-category" name="category" className="field-input" defaultValue={initial?.category ?? 'books'} {...bad('category')}>
              {categories.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
            <FieldError id="category" message={errors.category} />
          </div>
          <div>
            <label className="field-label" htmlFor="sell-phone">Your phone (optional)</label>
            <input id="sell-phone" name="phone" type="tel" className="field-input" defaultValue={initial?.phone} placeholder="+91 98765 43210" maxLength={20} autoComplete="tel" {...bad('phone')} />
            <FieldError id="phone" message={errors.phone} />
          </div>
        </div>
        <p className="field-hint">Your college email and phone stay private. Buyers can ask you to share them in a chat, and you decide whether to approve each request.</p>
        {generalError && <p className="error-box" role="alert">{generalError}</p>}
        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={pending || photoBusy}>
          {pending ? (editing ? 'SAVING…' : 'POSTING…') : photoBusy ? 'PREPARING PHOTO…' : submitLabel}
        </button>
      </div>

      <div>
        <label className="field-label" htmlFor="sell-photo">Photo</label>
        <input ref={fileRef} id="sell-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPhoto} tabIndex={-1} aria-describedby={errors.photo ? 'err-photo' : undefined} />
        {preview ? (
          <div className="photo-preview-wrap">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Preview of your listing photo" />
            <div className="photo-preview-actions">
              <button id="sell-photo-trigger" type="button" className="btn btn-outline btn-sm" onClick={() => fileRef.current?.click()}>Change photo</button>
              {blobRef.current && <button type="button" className="btn btn-outline btn-sm" onClick={removePhoto}>{editing ? 'Keep current photo' : 'Remove'}</button>}
            </div>
          </div>
        ) : (
          <button id="sell-photo-trigger" type="button" className="photo-drop" onClick={() => fileRef.current?.click()} {...(errors.photo ? { 'aria-invalid': true as const } : {})}>
            <span className="headline">ADD A PHOTO</span>
            <span className="sub">JPG, PNG, WebP · up to 4MB</span>
          </button>
        )}
        <FieldError id="photo" message={errors.photo} />

        <div className="listing-preview" aria-hidden="true">
          <p className="eyebrow">Live preview · how buyers see it</p>
          <article className="item-card is-preview">
            <div className="item-media-wrap">
              <div className="item-media">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {preview ? <img src={preview} alt="" /> : <div className="item-media-empty">No photo yet</div>}
              </div>
              <span className={`item-type-badge ${previewStatus.cls}`}>{previewStatus.label}</span>
            </div>
            <div className="item-info">
              <div className="item-info-main">
                <p className="item-category-label">{catLabel}</p>
                <h3><span className="item-title-link">{vals.title.trim() || 'Your title appears here'}</span></h3>
                <p className="item-meta-line">{conditionLabel(vals.condition)}</p>
                <p className="item-seller-line">Listed by <span>{sellerName}</span></p>
              </div>
              <div className="item-price-block">
                <span className="item-price">{priceNum > 0 ? formatPrice(priceNum) : '₹—'}</span>
                {previewTerms && <span className="item-price-unit">{previewTerms.perUnit}</span>}
                {previewTerms?.max && <span className="item-price-unit">{previewTerms.max}</span>}
              </div>
            </div>
          </article>
        </div>

        <div className="etiquette-box">
          <p className="eyebrow">Board etiquette</p>
          <p>Real photos get 3× more replies. Listings stay on the board until you mark them sold or rented. Meet on campus and verify items before paying.</p>
        </div>
      </div>
    </form>
  );
}
