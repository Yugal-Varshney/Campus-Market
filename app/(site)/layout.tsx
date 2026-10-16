import Navbar from '@/components/Navbar';
import AccountBanner from '@/components/AccountBanner';
import Footer from '@/components/Footer';
import OfflineBanner from '@/components/OfflineBanner';
import ChatDock from '@/components/messages/ChatDock';
import NewMessageAlerts from '@/components/messages/NewMessageAlerts';
import { getCurrentUser } from '@/lib/auth/session';
import { getUnreadCount } from '@/lib/messages/queries';

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unreadCount = user ? await getUnreadCount() : 0;
  return (
    <>
      <OfflineBanner />
      <Navbar />
      <AccountBanner />
      <main id="main" tabIndex={-1}>{children}</main>
      <Footer />
      {user && <ChatDock userId={user.id} initial={unreadCount} />}
      {user && <NewMessageAlerts userId={user.id} initial={unreadCount} />}
    </>
  );
}
