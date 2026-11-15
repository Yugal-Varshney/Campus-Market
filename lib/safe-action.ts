export const OFFLINE_MESSAGE = "Couldn't reach Campus Market. Check your connection and try again.";

export async function safely<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const digest = (err as { digest?: unknown } | null)?.digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) throw err;
    return { error: OFFLINE_MESSAGE } as unknown as T;
  }
}
