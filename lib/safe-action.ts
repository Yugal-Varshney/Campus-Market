/**
 * Runs a server action from a button and turns "the request never reached the server" (offline, dropped signal) into a
 * normal { error } the screen can show, instead of letting it crash the page into the error boundary.
 * Redirects are not errors: Next.js signals them with a NEXT_REDIRECT digest, so those are passed on untouched.
 * Pure module (no framework imports) so `npm test` can check it.
 */
export const OFFLINE_MESSAGE = "Couldn't reach Campus Market. Check your connection and try again.";

export async function safely<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const digest = (err as { digest?: unknown } | null)?.digest;
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT')) throw err;
    // Every action result on screen has the shape { error?: string, ...other optional fields }, so this is a valid result.
    return { error: OFFLINE_MESSAGE } as unknown as T;
  }
}
