import { expect, test } from '@playwright/test';
import { creds, have, login } from './helpers';

test.describe('authentication and access control', () => {
  test('signed-out visitors are sent to the login page with a return path', async ({ page }) => {
    for (const path of ['/sell', '/wishlist', '/messages', '/profile', '/moderator', '/admin']) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`/login\\?next=${encodeURIComponent(path).replace(/%/g, '%')}`));
    }
  });

  test('the login page and the register page are reachable', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'SIGN IN' })).toBeVisible();
    await page.goto('/register');
    await expect(page.getByRole('button', { name: 'CREATE ACCOUNT' })).toBeVisible();
  });

  test('registration rejects an address that is not a college email', async ({ page }) => {
    await page.goto('/register');
    await page.locator('#register-name').fill('E2E Tester');
    await page.locator('#register-email').fill('someone@gmail.com');
    await page.locator('#register-password').fill('a-long-enough-password');
    await page.getByRole('button', { name: 'CREATE ACCOUNT' }).click();
    await expect(page.getByRole('alert')).toContainText(/college/i);
  });

  test('a wrong password shows a clear error and does not sign in', async ({ page }) => {
    test.skip(!have('A'), 'E2E_STUDENT_A_* not set');
    await page.goto('/login');
    await page.locator('#login-email').fill(creds('A')!.email);
    await page.locator('#login-password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: 'SIGN IN' }).click();
    await expect(page.getByRole('alert')).toContainText(/wrong email or password/i);
    await expect(page).toHaveURL(/\/login/);
  });

  test('a student can sign in, is kept out of staff pages, and can sign out', async ({ page }) => {
    test.skip(!have('A'), 'E2E_STUDENT_A_* not set');
    await login(page, 'A');
    for (const path of ['/moderator', '/admin', '/admin/audit', '/admin/categories']) {
      const res = await page.goto(path);
      expect(res?.status(), `${path} should look like a missing page to a student`).toBe(404);
    }
    await page.goto('/marketplace');
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Moderation' })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: 'Admin' })).toHaveCount(0);
    await page.getByRole('menuitem', { name: 'Sign out' }).click();
    await page.goto('/sell');
    await expect(page).toHaveURL(/\/login/);
  });

  test('redirect tricks in ?next= never leave the site', async ({ page, baseURL }) => {
    test.skip(!have('A'), 'E2E_STUDENT_A_* not set');
    const origin = new URL(baseURL!).origin;
    for (const next of ['//evil.example', '/\t/evil.example', 'https://evil.example', '/\\evil.example']) {
      await page.context().clearCookies();
      await page.goto(`/login?next=${encodeURIComponent(next)}`);
      await page.locator('#login-email').fill(creds('A')!.email);
      await page.locator('#login-password').fill(creds('A')!.password);
      await page.getByRole('button', { name: 'SIGN IN' }).click();
      await page.waitForURL(/\/marketplace/);
      expect(new URL(page.url()).origin, `next=${JSON.stringify(next)}`).toBe(origin);
    }
  });

  test('staff accounts see their menu entries', async ({ page }) => {
    test.skip(!have('MOD'), 'E2E_MODERATOR_* not set');
    await login(page, 'MOD');
    await page.getByRole('button', { name: 'Account menu' }).click();
    await expect(page.getByRole('menuitem', { name: 'Moderation' })).toBeVisible();
    const res = await page.goto('/admin');
    expect(res?.status(), 'a moderator is not an admin').toBe(404);
  });

  test('an admin can open every staff page', async ({ page }) => {
    test.skip(!have('ADMIN'), 'E2E_ADMIN_* not set');
    await login(page, 'ADMIN');
    for (const path of ['/moderator', '/admin', '/admin/categories', '/admin/audit']) {
      const res = await page.goto(path);
      expect(res?.status(), path).toBeLessThan(400);
    }
  });
});
