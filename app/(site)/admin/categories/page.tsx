import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/staff/auth';
import { getAllCategories } from '@/lib/staff/queries';
import StaffNav from '@/components/staff/StaffNav';
import CategoryAdmin from '@/components/staff/CategoryAdmin';

export const metadata: Metadata = { title: 'Admin · categories' };
export const dynamic = 'force-dynamic';

export default async function CategoriesPage() {
  const role = await requireAdmin();
  const categories = await getAllCategories();
  return (
    <div className="messages-shell">
      <header>
        <h1 className="font-display">CATEGORIES</h1>
        <p className="sub font-mono">What students can pick when they post, and filter by</p>
      </header>
      <StaffNav role={role} current="categories" />
      <CategoryAdmin categories={categories} />
    </div>
  );
}
