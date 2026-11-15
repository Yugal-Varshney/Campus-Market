import type { ValidListing } from '@/lib/validation/listing';

export type ModerationDecision = 'allow' | 'review' | 'reject';
export interface ModerationResult {
  decision: ModerationDecision;
  reasons: string[];
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- placeholder: the parameter is part of the contract
export async function moderateListing(_listing: ValidListing): Promise<ModerationResult> {
  return { decision: 'allow', reasons: [] };
}
