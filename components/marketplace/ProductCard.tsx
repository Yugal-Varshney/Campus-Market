import Image from 'next/image';
import Link from 'next/link';
import { categoryLabel, conditionLabel } from '@/lib/constants';
import { formatPrice, rentTerms, statusInfo } from '@/lib/format';
import type { Product } from '@/types';
import WishlistButton from './WishlistButton';

export default function ProductCard({ item, wishlisted, index = 0, categoryNames }: { item: Product; wishlisted: boolean; index?: number; categoryNames?: Record<string, string> }) {
  const st = statusInfo(item);
  const terms = rentTerms(item);
  const meta = [item.condition ? conditionLabel(item.condition) : null, item.campusLocation || null].filter(Boolean).join(' · ');
  return (
    <article className={`item-card${st.done ? ' is-done' : ''}`} style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}>
      <div className="item-media-wrap">
        {/* The photo is a second link to the same page as the title, so it is skipped by keyboard and screen readers. */}
        <Link href={`/marketplace/${item.id}`} tabIndex={-1} aria-hidden="true">
          <div className="item-media">
            {item.imageUrl ? (
              <Image src={item.imageUrl} alt="" width={600} height={750} sizes="(min-width:1280px) 25vw, (min-width:640px) 50vw, 100vw" priority={index < 4} />
            ) : (
              <div className="item-media-empty">No photo yet</div>
            )}
          </div>
        </Link>
        <span className={`item-type-badge ${st.cls}`}>{st.label}</span>
        <WishlistButton itemId={item.id} initial={wishlisted} />
      </div>
      <div className="item-info">
        <div className="item-info-main">
          <p className="item-category-label">{categoryLabel(item.category, categoryNames)}</p>
          <h3><Link href={`/marketplace/${item.id}`} className="item-title-link">{item.title}</Link></h3>
          {meta && <p className="item-meta-line">{meta}</p>}
          <p className="item-seller-line">Listed by <span>{item.sellerName}</span></p>
        </div>
        <div className="item-price-block">
          <span className="item-price">{formatPrice(item.price)}</span>
          {terms && <span className="item-price-unit">{terms.perUnit}</span>}
          {terms?.max && <span className="item-price-unit">{terms.max}</span>}
        </div>
      </div>
    </article>
  );
}
