import Navbar from '@/components/Navbar';
import AccountBanner from '@/components/AccountBanner';
import Footer from '@/components/Footer';
import OfflineBanner from '@/components/OfflineBanner';
import { getCurrentUser } from '@/lib/auth/session';
import Link from 'next/link';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <>
      <OfflineBanner />
      <Navbar />
      <AccountBanner />
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
      {user && (
        <Link href="/messages" className="chat-dock font-display visible" aria-label="Open messages">CHAT</Link>
      )}
    </>
  );
}
