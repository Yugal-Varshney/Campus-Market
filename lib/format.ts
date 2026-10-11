import { RENT_UNITS } from '@/lib/constants';
import type { Listing } from '@/types';

export function formatPrice(price: number | string): string {
  return '₹' + Number(price).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export function timeAgo(iso: string, now: number = Date.now()): string {
  const seconds = Math.max(1, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? '1 day ago' : `${days} days ago`;
}

/** Label + CSS class for a listing's state (same classes as V1). */
export function statusInfo(item: Pick<Listing, 'status' | 'listingType'>) {
  if (item.status === 'sold') return { label: 'SOLD', cls: 'sold', done: true };
  if (item.status === 'rented') return { label: 'RENTED', cls: 'rented-out', done: true };
  // 'inactive' is set by the database (migration 006); there is no screen that sets it yet.
  if (item.status === 'inactive') return { label: 'UNAVAILABLE', cls: 'sold', done: true };
  if (item.listingType === 'rent') return { label: 'FOR RENT', cls: 'rent', done: false };
  return { label: 'FOR SALE', cls: 'sell', done: false };
}

/**
 * How a rental is priced: "per week" plus an optional "up to 4 weeks" limit. Rentals created before migration 011
 * have no unit stored; they were always shown per week, so that stays the fallback. Returns null for items for sale.
 */
export function rentTerms(item: Pick<Listing, 'listingType' | 'rentUnit' | 'rentMaxUnits'>): { perUnit: string; max: string | null } | null {
  if (item.listingType !== 'rent') return null;
  const unit = RENT_UNITS.find((u) => u.value === (item.rentUnit ?? 'week')) ?? RENT_UNITS[1];
  const n = item.rentMaxUnits;
  return {
    perUnit: `per ${unit.label.toLowerCase()}`,
    max: n && n > 0 ? `up to ${n} ${n === 1 ? unit.label.toLowerCase() : unit.plural}` : null,
  };
}
