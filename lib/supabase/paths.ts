export const ALWAYS_PROTECTED = ['/sell', '/wishlist', '/saved-searches', '/messages', '/profile', '/moderator', '/admin'];
export const AUTH_PAGES = ['/login', '/register'];

const under = (path: string, base: string) => path === base || path.startsWith(base + '/');

export function isProtectedPath(path: string, requireLoginToBrowse: boolean): boolean {
  return ALWAYS_PROTECTED.some((p) => under(path, p)) || (requireLoginToBrowse && under(path, '/marketplace'));
}
