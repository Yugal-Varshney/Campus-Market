/** Input rules for the staff screens. The database enforces the same limits; these give clear messages first. */

export const REASON_MIN = 3;
export const REASON_MAX = 1000;

export function cleanReason(input: unknown): { value: string } | { error: string } {
  const v = typeof input === 'string' ? input.trim() : '';
  if (v.length < REASON_MIN || v.length > REASON_MAX) return { error: `Write a reason of ${REASON_MIN} to ${REASON_MAX} characters.` };
  return { value: v };
}

export const SUSPENSION_CHOICES: { value: string; label: string; adminOnly?: boolean }[] = [
  { value: '1', label: '1 day' },
  { value: '3', label: '3 days' },
  { value: '7', label: '7 days' },
  { value: '14', label: '14 days', adminOnly: true },
  { value: '30', label: '30 days', adminOnly: true },
  { value: 'indefinite', label: 'Until further notice', adminOnly: true },
];

/**
 * Suspension end date for a dropdown choice. Moderators are limited to 7 days by the database. The end is set a few
 * minutes short of the exact day count so a small clock difference between this server and the database can never
 * push a 7-day suspension over the limit.
 */
export function suspensionUntil(choice: unknown, role: 'moderator' | 'admin', now: Date = new Date()): { until: string | null } | { error: string } {
  if (choice === 'indefinite') {
    return role === 'admin' ? { until: null } : { error: 'Only an admin can suspend without an end date.' };
  }
  const days = typeof choice === 'string' ? Number(choice) : NaN;
  if (!Number.isInteger(days) || days < 1 || days > 90) return { error: 'Choose how long the suspension lasts.' };
  if (role === 'moderator' && days > 7) return { error: 'Moderators can suspend for at most 7 days.' };
  return { until: new Date(now.getTime() + days * 86_400_000 - 5 * 60_000).toISOString() };
}

export const ROLES = ['student', 'moderator', 'admin'] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === 'string' && UUID_RE.test(v);
export const isId = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v) && v > 0;

/** Category rules from migration 008: name 2-40 characters, slug a-z / 0-9 / "-" (2-40), description up to 200. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function validateCategory(input: { name: unknown; slug?: unknown; description?: unknown }, requireSlug: boolean):
  { value: { name: string; slug: string; description: string } } | { error: string } {
  const name = typeof input.name === 'string' ? input.name.trim() : '';
  if (name.length < 2 || name.length > 40) return { error: 'Category name must be 2 to 40 characters.' };
  const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : '';
  if (requireSlug && !/^[a-z0-9-]{2,40}$/.test(slug)) return { error: 'The short name (slug) must be 2 to 40 characters: letters, numbers and dashes.' };
  const description = typeof input.description === 'string' ? input.description.trim() : '';
  if (description.length > 200) return { error: 'Description is limited to 200 characters.' };
  return { value: { name, slug, description } };
}
