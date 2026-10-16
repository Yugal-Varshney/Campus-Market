'use client';

import { useEffect, useState } from 'react';

/** Tells people when their connection drops, so a failed save is not a mystery. Hidden while online. */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const sync = () => setOffline(!navigator.onLine);
    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => { window.removeEventListener('online', sync); window.removeEventListener('offline', sync); };
  }, []);
  return <div className="offline-banner" role="status" hidden={!offline}>{offline ? "You're offline. Changes won't save until your connection is back." : ''}</div>;
}
