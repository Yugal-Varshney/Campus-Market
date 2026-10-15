/** Which pages require sign-in. A regression here would expose a page to signed-out visitors. */
import { AUTH_PAGES, isProtectedPath } from '../lib/supabase/paths';

let failed = 0;
const t = (name: string, cond: boolean) => { console.log(`${cond ? 'PASS' : 'FAIL'} ${name}`); if (!cond) failed++; };

for (const p of ['/sell', '/sell/12/edit', '/wishlist', '/messages', '/profile']) t(`${p} needs sign-in`, isProtectedPath(p, false) && isProtectedPath(p, true));
for (const p of ['/moderator', '/moderator/reports/5', '/admin', '/admin/audit', '/admin/categories']) t(`${p} needs sign-in even when browsing is open`, isProtectedPath(p, false));
t('marketplace needs sign-in when browsing is closed', isProtectedPath('/marketplace', true) && isProtectedPath('/marketplace/42', true));
t('marketplace is open when REQUIRE_LOGIN_TO_BROWSE=false', !isProtectedPath('/marketplace', false) && !isProtectedPath('/marketplace/42', false));
t('login and register pages are public', !isProtectedPath('/login', true) && !isProtectedPath('/register', true));
t('password reset page is public (it checks the recovery session itself)', !isProtectedPath('/reset-password', true));
t('auth callback is public', !isProtectedPath('/auth/callback', true));
t('home page is public', !isProtectedPath('/', true));
t('look-alike paths are not caught by accident', !isProtectedPath('/selling', false) && !isProtectedPath('/administrator', false) && !isProtectedPath('/profile-photos', false));
t('login and register are the two sign-in pages', AUTH_PAGES.join() === '/login,/register');

if (failed) { console.error(`\n${failed} test(s) failed`); process.exit(1); }
console.log('\nAll tests passed');
