import Link from 'next/link';

export default function StaffNav({ role, current }: { role: 'moderator' | 'admin'; current: 'reports' | 'users' | 'categories' | 'audit' }) {
  const item = (href: string, label: string, key: string) => (
    <Link href={href} className={`staff-tab${current === key ? ' active' : ''}`} aria-current={current === key ? 'page' : undefined}>{label}</Link>
  );
  return (
    <nav className="staff-nav" aria-label="Staff">
      {item('/moderator', 'Reports', 'reports')}
      {role === 'admin' && item('/admin', 'Users', 'users')}
      {role === 'admin' && item('/admin/categories', 'Categories', 'categories')}
      {role === 'admin' && item('/admin/audit', 'Audit log', 'audit')}
    </nav>
  );
}
