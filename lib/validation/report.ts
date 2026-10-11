import { REPORT_REASONS } from '@/lib/constants';
import type { ReportReason } from '@/types';

/** Mirrors the database rules in migration 007: known reason, description up to 500 characters, "other" needs 10+. */
export function validateReport(reason: string, description: string): { value?: { reason: ReportReason; description: string }; error?: string } {
  const found = REPORT_REASONS.find((r) => r.value === reason);
  if (!found) return { error: 'Pick a reason for your report.' };
  const text = description.trim();
  if (text.length > 500) return { error: 'Please keep the details to 500 characters or fewer.' };
  if (found.value === 'other' && text.length < 10) return { error: 'Please add a few words (at least 10 characters) explaining the problem.' };
  return { value: { reason: found.value, description: text } };
}
