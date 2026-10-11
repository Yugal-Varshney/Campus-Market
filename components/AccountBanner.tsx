import { getAccountNotice } from '@/lib/account/status';

export default async function AccountBanner() {
  const notice = await getAccountNotice();
  if (!notice) return null;
  return <div className={`account-banner ${notice.kind}`} role="status">{notice.text}</div>;
}
