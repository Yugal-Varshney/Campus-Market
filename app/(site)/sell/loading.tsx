export default function Loading() {
  return (
    <div className="sell-shell" aria-busy="true">
      <h1 className="font-display">PIN A LISTING</h1>
      <p className="sr-only" role="status">Loading the form...</p>
      <div className="skeleton" style={{ height: '2.75rem', marginTop: '1.5rem' }} />
      <div className="skeleton" style={{ height: '8rem', marginTop: '1rem' }} />
      <div className="skeleton" style={{ height: '2.75rem', marginTop: '1rem' }} />
    </div>
  );
}
