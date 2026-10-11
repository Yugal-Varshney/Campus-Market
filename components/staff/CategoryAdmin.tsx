'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { createCategory, setCategoryActive, updateCategory } from '@/lib/staff/actions';
import { slugify } from '@/lib/validation/staff';

type Result = { error?: string; success?: string };
export interface CategoryItem { id: number; name: string; slug: string; description: string; is_active: boolean; sort_order: number; listings: number }

function Row({ c }: { c: CategoryItem }) {
  const router = useRouter();
  const [name, setName] = useState(c.name);
  const [description, setDescription] = useState(c.description);
  const [sort, setSort] = useState(String(c.sort_order));
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState<Result>({});
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<Result>) => {
    setMsg({});
    start(async () => {
      const res = await fn();
      setMsg(res);
      if (res.success) { setReason(''); router.refresh(); }
    });
  };

  return (
    <details className="staff-card">
      <summary>
        <strong>{c.name}</strong> · <code>{c.slug}</code> · {c.listings} listing{c.listings === 1 ? '' : 's'} · <span className={`staff-status ${c.is_active ? '' : 'suspended'}`}>{c.is_active ? 'active' : 'disabled'}</span>
      </summary>
      <div className="mod-panel">
        <label className="field-label" htmlFor={`cat-name-${c.id}`}>Name</label>
        <input id={`cat-name-${c.id}`} className="field-input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} />
        <label className="field-label" htmlFor={`cat-desc-${c.id}`}>Description (optional)</label>
        <input id={`cat-desc-${c.id}`} className="field-input" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        <label className="field-label" htmlFor={`cat-sort-${c.id}`}>Order in lists (lower comes first)</label>
        <input id={`cat-sort-${c.id}`} className="field-input mod-select" type="number" min={0} max={10000} value={sort} onChange={(e) => setSort(e.target.value)} />
        <div className="mod-row">
          <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => run(() => updateCategory(c.id, name, description, Number(sort)))}>SAVE</button>
        </div>
        <label className="field-label" htmlFor={`cat-reason-${c.id}`}>{c.is_active ? 'Reason for disabling' : 'Reason for enabling'} (saved in the audit log)</label>
        <input id={`cat-reason-${c.id}`} className="field-input" value={reason} maxLength={1000} onChange={(e) => setReason(e.target.value)} />
        <div className="mod-row">
          <button type="button" className="btn btn-outline btn-sm" disabled={pending} onClick={() => run(() => setCategoryActive(c.id, !c.is_active, reason))}>
            {c.is_active ? 'DISABLE CATEGORY' : 'ENABLE CATEGORY'}
          </button>
          <span className="mod-hint">The short name (slug) <code>{c.slug}</code> never changes. Disabling hides the category from new listings; existing listings keep it.</span>
        </div>
        {msg.error && <p className="error-box" role="alert">{msg.error}</p>}
        {msg.success && <p className="mod-ok" role="status">{msg.success}</p>}
      </div>
    </details>
  );
}

export default function CategoryAdmin({ categories }: { categories: CategoryItem[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [msg, setMsg] = useState<Result>({});
  const [pending, start] = useTransition();

  const add = (e: React.FormEvent) => {
    e.preventDefault();
    setMsg({});
    start(async () => {
      const res = await createCategory(name, slug, description);
      setMsg(res);
      if (res.success) { setName(''); setSlug(''); setSlugTouched(false); setDescription(''); router.refresh(); }
    });
  };

  return (
    <>
      <form className="staff-card mod-panel" onSubmit={add} noValidate>
        <h2>Add a category</h2>
        <label className="field-label" htmlFor="new-cat-name">Name</label>
        <input id="new-cat-name" className="field-input" value={name} maxLength={40}
          onChange={(e) => { setName(e.target.value); if (!slugTouched) setSlug(slugify(e.target.value)); }} />
        <label className="field-label" htmlFor="new-cat-slug">Short name (slug, cannot be changed later)</label>
        <input id="new-cat-slug" className="field-input" value={slug} maxLength={40} onChange={(e) => { setSlug(e.target.value); setSlugTouched(true); }} />
        <label className="field-label" htmlFor="new-cat-desc">Description (optional)</label>
        <input id="new-cat-desc" className="field-input" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        <div className="mod-row"><button type="submit" className="btn btn-dark btn-sm" disabled={pending}>ADD CATEGORY</button></div>
        {msg.error && <p className="error-box" role="alert">{msg.error}</p>}
        {msg.success && <p className="mod-ok" role="status">{msg.success}</p>}
      </form>
      {categories.map((c) => <Row key={c.id} c={c} />)}
    </>
  );
}
