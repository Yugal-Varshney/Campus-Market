import Link from 'next/link';
import { marketplaceHref } from '@/lib/listings/search-params';

export default function Pagination({ page, total, pageSize, params }: { page: number; total: number; pageSize: number; params: Record<string, string | undefined> }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const href = (n: number) => marketplaceHref({ ...params, page: n > 1 ? String(n) : undefined });
  return (
    <nav className="pagination" aria-label="Pagination">
      {page <= 1
        ? <span className="btn btn-outline" aria-disabled="true">← Prev</span>
        : <Link className="btn btn-outline" href={href(page - 1)} rel="prev">← Prev</Link>}
      <span aria-current="page">Page {page} of {pages}</span>
      {page >= pages
        ? <span className="btn btn-outline" aria-disabled="true">Next →</span>
        : <Link className="btn btn-outline" href={href(page + 1)} rel="next">Next →</Link>}
    </nav>
  );
}
