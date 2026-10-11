import { GridSkeleton } from '@/components/marketplace/ProductGrid';

export default function Loading() {
  return (
    <div className="messages-shell">
      <header className="listings-header" style={{ marginBottom: '2rem' }}><h1 className="font-display">MY WISHLIST</h1></header>
      <p className="sr-only" role="status">Loading your wishlist...</p>
      <GridSkeleton cols={4} />
    </div>
  );
}
