/**
 * Which URLs need a signed-in person. Kept free of framework imports so `npm test` can check the rules directly.
 * The staff paths are listed here only to send signed-out visitors to the login page; whether a signed-in person may
 * see them is decided on the page (requireStaff / requireAdmin) and, underneath, by the database.
 */
export const ALWAYS_PROTECTED = ['/sell', '/wishlist', '/messages', '/profile', '/moderator', '/admin'];
export const AUTH_PAGES = ['/login', '/register'];

const under = (path: string, base: string) => path === base || path.startsWith(base + '/');

export function isProtectedPath(path: string, requireLoginToBrowse: boolean): boolean {
  return ALWAYS_PROTECTED.some((p) => under(path, p)) || (requireLoginToBrowse && under(path, '/marketplace'));
}
