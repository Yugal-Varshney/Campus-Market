import { expect, test } from '@playwright/test';
import { createListing, deleteListing, have, login, uniq } from './helpers';

// Runs in the "mobile" project (Pixel 5, 393 px wide).
test.describe('phone layout', () => {
  test.skip(!have('A'), 'E2E_STUDENT_A_* not set');

  const noSideScroll = async (page: import('@playwright/test').Page, label: string) => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${label} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(1);
  };

  test('marketplace has a search box and does not scroll sideways', async ({ page }) => {
    await login(page, 'A');
    await page.goto('/marketplace');
    await expect(page.locator('.mobile-search input[name="q"]')).toBeVisible();
    await noSideScroll(page, '/marketplace');
  });

  test('search works from the phone search box', async ({ page }) => {
    await login(page, 'A');
    const title = uniq('phone');
    const id = await createListing(page, { title, price: 33 });
    await page.goto('/marketplace');
    await page.locator('.mobile-search input[name="q"]').fill(title);
    await page.locator('.mobile-search').getByRole('button', { name: 'SEARCH' }).click();
    await expect(page.getByRole('link', { name: title }).first()).toBeVisible();
    await noSideScroll(page, 'search results');
    await deleteListing(page, id);
  });

  test('sell form, wishlist and messages fit the screen', async ({ page }) => {
    await login(page, 'A');
    for (const path of ['/sell', '/wishlist', '/messages', '/profile']) { await page.goto(path); await noSideScroll(page, path); }
  });
});
