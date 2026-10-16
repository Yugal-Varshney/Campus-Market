import { expect, test, type Page } from '@playwright/test';
import { createListing, deleteListing, have, login, session, uniq } from './helpers';

// UX plan, Phase 5: keyboard use, small screens, offline behaviour, and the Phase 2-4 flows end to end.
// Runs in the "desktop" project; phone widths are set per group below.

/** True when the element that has keyboard focus shows it (an outline or a focus ring). */
const focusIsVisible = (page: Page) => page.evaluate(() => {
  const el = document.activeElement as HTMLElement | null;
  if (!el || el === document.body) return true;
  const cs = getComputedStyle(el);
  return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none';
});

/** Presses Tab `n` times and returns a description of every stop that shows no focus indicator. */
async function tabAudit(page: Page, n: number): Promise<string[]> {
  const bad: string[] = [];
  for (let i = 0; i < n; i++) {
    await page.keyboard.press('Tab');
    if (!(await focusIsVisible(page))) {
      bad.push(await page.evaluate(() => { const e = document.activeElement as HTMLElement; return `${e.tagName.toLowerCase()}.${e.className} "${(e.textContent ?? '').trim().slice(0, 30)}"`; }));
    }
  }
  return bad;
}

const noSideScroll = async (page: Page, label: string) => {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, `${label} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(1);
};

test.describe('keyboard (public pages)', () => {
  test('the skip link is the first tab stop and jumps to the content', async ({ page }) => {
    await page.goto('/');
    await page.keyboard.press('Tab');
    await expect(page.locator('.skip-link')).toBeFocused();
    await page.keyboard.press('Enter');
    expect(page.url()).toContain('#main');
  });

  for (const path of ['/', '/login', '/register']) {
    test(`every tab stop on ${path} shows where focus is`, async ({ page }) => {
      await page.goto(path);
      expect(await tabAudit(page, 25)).toEqual([]);
    });
  }
});

test.describe('small screens (375 px wide, public pages)', () => {
  test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });
  for (const path of ['/', '/login', '/register']) {
    test(`${path} does not scroll sideways`, async ({ page }) => { await page.goto(path); await noSideScroll(page, path); });
  }
});

test('a lost connection is announced, and clears when it returns', async ({ page, context }) => {
  await page.goto('/');
  const banner = page.locator('.offline-banner');
  await expect(banner).toBeHidden();
  await context.setOffline(true);
  await expect(banner).toBeVisible();
  await expect(banner).toContainText("You're offline");
  await context.setOffline(false);
  await expect(banner).toBeHidden();
});

test.describe('signed in as a student', () => {
  test.skip(!have('A'), 'E2E_STUDENT_A_* not set');

  test('keyboard: every tab stop on the marketplace shows where focus is', async ({ page }) => {
    await login(page, 'A');
    await page.goto('/marketplace');
    expect(await tabAudit(page, 30)).toEqual([]);
  });

  test('a listing that does not exist shows a clear way back', async ({ page }) => {
    await login(page, 'A');
    await page.goto('/marketplace/999999999');
    await expect(page.getByRole('heading', { name: 'LISTING NOT FOUND' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Back to the Board' })).toBeVisible();
  });

  test('category chips and filter pills narrow and widen the results', async ({ page }) => {
    await login(page, 'A');
    await page.goto('/marketplace');
    const chips = page.getByRole('navigation', { name: 'Categories' });
    await expect(chips.getByRole('link', { name: 'All' })).toHaveAttribute('aria-current', 'true');
    const first = chips.getByRole('link').nth(1);
    await first.click();
    await expect(page).toHaveURL(/category=/);
    await expect(first).toHaveAttribute('aria-current', 'true');
    const pills = page.getByRole('group', { name: 'Active filters' });
    await expect(pills).toBeVisible();
    await pills.getByRole('link', { name: 'Clear all' }).click();
    await expect(page).not.toHaveURL(/category=/);
  });

  test('a search with no matches explains itself and offers a way out', async ({ page }) => {
    await login(page, 'A');
    await page.goto(`/marketplace?q=${encodeURIComponent(uniq('nothing-matches-this'))}`);
    await expect(page.getByRole('heading', { name: 'No matches found' })).toBeVisible();
    await page.getByRole('link', { name: 'Clear filters' }).click();
    await expect(page).toHaveURL(/\/marketplace$/);
  });

  test('save a search, find it under Saved searches, delete it', async ({ page }) => {
    await login(page, 'A');
    const term = uniq('saved').toLowerCase();
    await page.goto(`/marketplace?q=${encodeURIComponent(term)}`);
    await page.getByRole('button', { name: 'SAVE THIS SEARCH' }).click();
    await expect(page.getByRole('link', { name: /Search saved/ })).toBeVisible();
    await page.goto('/saved-searches');
    const row = page.getByRole('listitem').filter({ hasText: term });
    await expect(row).toBeVisible();
    await expect(row.getByRole('button', { name: 'ALERTS ON' })).toBeVisible();
    page.once('dialog', (d) => d.accept());
    await row.getByRole('button', { name: 'DELETE' }).click();
    await expect(page.getByRole('listitem').filter({ hasText: term })).toHaveCount(0);
  });

  test('after posting, the seller sees a confirmation with share options', async ({ page }) => {
    await login(page, 'A');
    const id = await createListing(page, { title: uniq('share'), price: 99 });
    await expect(page.getByText('Your listing is live.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'COPY LINK' })).toBeVisible();
    await deleteListing(page, id);
  });

  test('the sell form points at the field that needs fixing', async ({ page }) => {
    await login(page, 'A');
    await page.goto('/sell');
    await page.getByRole('button', { name: 'POST LISTING' }).click();
    await expect(page.locator('#err-title')).toBeVisible();
    await expect(page.locator('#sell-title')).toBeFocused();
    await expect(page.locator('#sell-title')).toHaveAttribute('aria-invalid', 'true');
  });

  test.describe('on a phone', () => {
    test.use({ viewport: { width: 375, height: 812 }, hasTouch: true });

    test('filters open and close from one button', async ({ page }) => {
      await login(page, 'A');
      await page.goto('/marketplace');
      const toggle = page.getByRole('button', { name: /^Filters/ });
      await expect(toggle).toHaveAttribute('aria-expanded', 'false');
      await expect(page.getByLabel('Include sold and rented')).toBeHidden();
      await toggle.click();
      await expect(toggle).toHaveAttribute('aria-expanded', 'true');
      await expect(page.getByLabel('Include sold and rented')).toBeVisible();
    });

    test('new pages fit the screen', async ({ page }) => {
      await login(page, 'A');
      for (const path of ['/marketplace', '/saved-searches', '/sell']) { await page.goto(path); await noSideScroll(page, path); }
    });
  });

  test.describe('with a second student', () => {
    test.skip(!have('A', 'B'), 'E2E_STUDENT_B_* not set');

    test('a buyer reaches the seller with one tap', async ({ browser }) => {
      const seller = await session(browser, 'A');
      const buyer = await session(browser, 'B');
      const id = await createListing(seller.page, { title: uniq('quick'), price: 75 });
      await buyer.page.goto(`/marketplace/${id}`);
      await buyer.page.getByRole('button', { name: 'Is this still available?' }).click();
      await expect(buyer.page).toHaveURL(/\/messages\?c=\d+/);
      await expect(buyer.page.getByText('Is this still available?').first()).toBeVisible();
      await deleteListing(seller.page, id);
      await seller.ctx.close(); await buyer.ctx.close();
    });
  });
});

test.describe('admin usage numbers', () => {
  test.skip(!have('ADMIN'), 'E2E_ADMIN_* not set');
  test('the usage screen loads for an admin', async ({ page }) => {
    await login(page, 'ADMIN');
    await page.goto('/admin/usage');
    await expect(page.getByRole('heading', { name: 'Activity' })).toBeVisible();
    await expect(page.getByText('Active students')).toBeVisible();
  });
});
