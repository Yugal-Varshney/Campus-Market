'use client';

/** Last resort: the root layout itself failed, so this page brings its own <html> and <body>. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '3rem 1rem', textAlign: 'center' }}>
        <h1>Campus Market is having trouble</h1>
        <p>Please try again in a moment.</p>
        <button type="button" onClick={reset} style={{ padding: '0.6rem 1.2rem', fontSize: '1rem', cursor: 'pointer' }}>Try again</button>
      </body>
    </html>
  );
}
