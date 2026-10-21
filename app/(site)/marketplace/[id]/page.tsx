import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { getCurrentUser } from '@/lib/auth/session';
import { countConversations, getListing, getWishlistIds } from '@/lib/listings/queries';
import { categoryLabel, conditionLabel } from '@/lib/constants';
import { formatPrice, rentTerms, statusInfo, timeAgo } from '@/lib/format';
import { getShareForItem } from '@/lib/contact/queries';
import { getCategoryNames } from '@/lib/categories';
import SellerPanel from '@/components/product/SellerPanel';
import ReportButton from '@/components/report/ReportButton';
import ShareButton from '@/components/product/ShareButton';

const load = cache(async (raw: string) => getListing(/^\d+$/.test(raw) ? Number(raw) : -1));

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const item = await load((await params).id).catch(() => null);
  return { title: item ? item.title : 'Listing not found' };
}

export default async function ItemPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  // Listing and auth are independent, so don't serialize two network-backed operations.
  const [item, user] = await Promise.all([load(id), getCurrentUser()]);
  if (!item) notFound();
  const st = statusInfo(item);
  const isOwner = !!user && item.sellerId === user.id;
  const terms = rentTerms(item);

  // Resolve independent detail-page data concurrently after ownership is known.
  const [wishlistIds, conversationCount, share, names] = await Promise.all([
    user ? getWishlistIds(user.id) : Promise.resolve([] as number[]),
    isOwner ? countConversations(item.id) : Promise.resolve(0),
    user && !isOwner && item.sellerId ? getShareForItem(item.id, user.id) : Promise.resolve(null),
    getCategoryNames(),
  ]);
  const wishlisted = wishlistIds.includes(item.id);
  const hasConversations = conversationCount > 0;
  const justPosted = isOwner && sp.posted === '1';
  const justUpdated = isOwner && sp.updated === '1';

  return (
    <div className="detail-shell">
      <nav className="breadcrumb" aria-label="Breadcrumb">
        <Link href="/marketplace">Marketplace</Link><span className="sep">/</span>
        <Link href={`/marketplace?category=${item.category}`}>{categoryLabel(item.category, names)}</Link>
      </nav>
      <div className="detail-grid">
        <div className="detail-media">
          <div className="item-media">
            {item.imageUrl ? <Image src={item.imageUrl} alt={item.title} width={800} height={1000} priority sizes="(min-width:1024px) 50vw, 100vw" /> : <div className="item-media-empty">No photo yet</div>}
          </div>
          <span className={`item-type-badge ${st.cls}`}>{st.label}</span>
        </div>
        <div className="detail-info">
          {(justPosted || justUpdated) && (
            <div className="success-box success-banner" role="status">
              <strong>{justPosted ? 'Your listing is live.' : 'Changes saved.'}</strong>
              {justPosted && <p>Students can find it on the marketplace now. When someone messages you, the chat shows up under Messages.</p>}
              {justPosted && <ShareButton path={`/marketplace/${item.id}`} title={item.title} price={formatPrice(item.price)} />}
              <div className="success-actions">
                {justPosted && <Link href="/sell" className="btn btn-dark btn-sm">Post another</Link>}
                <Link href="/marketplace" className="btn btn-outline btn-sm">See the marketplace</Link>
              </div>
            </div>
          )}
          <p className="detail-meta">{categoryLabel(item.category, names)} · {item.listingType === 'rent' ? 'For rent' : 'For sale'}</p>
          <h1 className="font-display detail-title">{item.title}</h1>
          <div className="detail-price-row">
            <span className="detail-price">{formatPrice(item.price)}</span>
            {terms && <span className="detail-price-unit">{terms.perUnit}</span>}
          </div>
          {terms?.max && <p className="detail-rent-max">Rent for {terms.max}</p>}
          <div className="stat-grid">
            <div className="stat-box"><p className="stat-label">Condition</p><p className="stat-value">{conditionLabel(item.condition)}</p></div>
            <div className="stat-box"><p className="stat-label">Seller</p><p className="stat-value">{item.sellerName}</p></div>
          </div>
          {item.description && <p className="detail-description">{item.description}</p>}
          {st.done && <div className="status-banner" role="status">This item has been {item.status}.</div>}
          <SellerPanel item={item} isOwner={isOwner} wishlisted={wishlisted} hasConversations={hasConversations} share={share} />
          {!justPosted && <ShareButton path={`/marketplace/${item.id}`} title={item.title} price={formatPrice(item.price)} />}
          {user && !isOwner && item.sellerId && <ReportButton listingId={item.id} label="Report this listing" />}
          <p className="detail-posted">Posted {timeAgo(item.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}
