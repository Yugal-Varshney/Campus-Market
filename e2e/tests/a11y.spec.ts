import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { createListing, deleteListing, have, login, uniq } from './helpers';

/** Automated WCAG 2.x A/AA scan. Only serious and critical findings fail the test; the rest are listed in the report. */
async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const bad = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(bad.map((v) => `${v.id} (${v.nodes.length}x): ${v.help}`), `accessibility problems on ${label}`).toEqual([]);
}

test.describe('accessibility scan', () => {
  test('signed-out pages', async ({ page }) => {
    for (const path of ['/', '/login', '/register']) { await page.goto(path); await scan(page, path); }
  });

  test('signed-in pages', async ({ page }) => {
    test.skip(!have('A'), 'E2E_STUDENT_A_* not set');
    await login(page, 'A');
    for (const path of ['/marketplace', '/saved-searches', '/sell', '/wishlist', '/messages', '/profile']) { await page.goto(path); await scan(page, path); }
    await page.goto(`/marketplace?q=${encodeURIComponent(uniq('nothing-matches'))}`);
    await scan(page, 'a search with no matches (empty state and filter pills)');
    const id = await createListing(page, { title: uniq('a11y'), price: 40 });
    await scan(page, 'a listing page right after posting (confirmation banner)');
    await page.goto(`/marketplace/${id}`);
    await scan(page, 'a listing page');
    await deleteListing(page, id);
  });

  test('staff pages', async ({ page }) => {
    test.skip(!have('ADMIN'), 'E2E_ADMIN_* not set');
    await login(page, 'ADMIN');
    for (const path of ['/moderator', '/admin', '/admin/usage', '/admin/categories', '/admin/audit']) { await page.goto(path); await scan(page, path); }
  });
});
