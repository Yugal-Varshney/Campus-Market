const KNOWN_CODES = ['ACCOUNT_BANNED', 'ACCOUNT_SUSPENDED', 'LISTING_HIDDEN', 'LISTING_REPORTED', 'RESERVED_NAME', 'CONTACT_SHARE', 'SAVED_SEARCH'] as const;

const capitalise = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

export function knownDbError(message: string | null | undefined): string | null {
  if (!message) return null;
  const msg = message.trim();

  if (/^RATE_LIMIT\b/.test(msg)) {
    const m = msg.match(/limit (\d+) per (\d+) minutes?/i);
    return m
      ? `You've reached the limit for this action (${m[1]} per ${m[2]} minutes). Please try again later.`
      : "You're doing that too often. Please wait a few minutes and try again.";
  }

  for (const code of KNOWN_CODES) {
    if (msg.startsWith(code + ':')) return capitalise(msg.slice(code.length + 1).trim());
  }
  return null;
}

export function friendlyDbError(message: string | null | undefined, fallback: string): string {
  return knownDbError(message) ?? fallback;
}
