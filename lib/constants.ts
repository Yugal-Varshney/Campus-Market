import type { Category, Condition, RentUnit, ReportReason, SortKey } from '@/types';

export const CATEGORIES: { value: Category; label: string }[] = [
  { value: 'books', label: 'Books' },
  { value: 'notes', label: 'Notes' },
  { value: 'electronics', label: 'Electronics' },
  { value: 'stationary', label: 'Stationary' },
];

export const CONDITIONS: { value: Condition; label: string }[] = [
  { value: 'new', label: 'Brand New' },
  { value: 'like-new', label: 'Like New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
];

/** Rental price units. `max` is the largest "longest rental" the form accepts for that unit (the database allows 1-365). */
export const RENT_UNITS: { value: RentUnit; label: string; plural: string; max: number }[] = [
  { value: 'day', label: 'Day', plural: 'days', max: 365 },
  { value: 'week', label: 'Week', plural: 'weeks', max: 52 },
  { value: 'month', label: 'Month', plural: 'months', max: 12 },
];

export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'prohibited_item', label: 'Prohibited item' },
  { value: 'misleading_information', label: 'Misleading information' },
  { value: 'duplicate_listing', label: 'Duplicate listing' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'other', label: 'Something else' },
];

export const SORTS: { value: SortKey; label: string }[] = [
  { value: 'newest', label: 'Sort: Newest First' },
  { value: 'price-asc', label: 'Sort: Price Low-High' },
  { value: 'price-desc', label: 'Sort: Price High-Low' },
];

export const PAGE_SIZE = 20;
export const MIN_PRICE = 1;
export const MAX_PRICE = 100000;
export const PRICE_SLIDER_MAX = 5000; // slider range only; "5,000+" means no upper cap
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;
export const IMAGE_BUCKET = 'item-images';
export const MIN_PASSWORD_LENGTH = 8;

export const categoryLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;
export const conditionLabel = (v: string) => CONDITIONS.find((c) => c.value === v)?.label ?? v;
