import { GridSkeleton } from '@/components/marketplace/ProductGrid';

export default function Loading() {
  return (
    <div className="messages-shell">
      <header><div className="skeleton" style={{ height: '2.5rem', width: '14rem' }} /></header>
      <p className="sr-only" role="status">Loading your profile...</p>
      <section className="my-listings"><h2>My listings</h2><GridSkeleton cols={4} count={4} /></section>
    </div>
  );
}
