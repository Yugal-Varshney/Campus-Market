import { expect, test } from '@playwright/test';
import { createListing, deleteListing, have, login, uniq } from './helpers';

test.describe.configure({ mode: 'serial' });

test.describe('listings: post, find, edit, rent, sell, delete', () => {
  test.skip(!have('A'), 'E2E_STUDENT_A_* not set');
  const saleTitle = uniq('sale');
  const rentTitle = uniq('rent');
  let saleId = 0, rentId = 0;

  test('post an item for sale', async ({ page }) => {
    await login(page, 'A');
    saleId = await createListing(page, { title: saleTitle, price: 250 });
    await expect(page.getByRole('heading', { name: saleTitle })).toBeVisible();
    await expect(page.getByText('₹250').first()).toBeVisible();
  });

  test('the new listing can be found by search', async ({ page }) => {
    await login(page, 'A');
    await page.goto(`/marketplace?q=${encodeURIComponent(saleTitle)}`);
    await expect(page.getByRole('link', { name: saleTitle }).first()).toBeVisible();
  });

  test('the seller can change the price', async ({ page }) => {
    await login(page, 'A');
    await page.goto(`/marketplace/${saleId}`);
    await page.getByRole('link', { name: 'EDIT' }).click();
    await page.locator('#sell-price').fill('300');
    await page.getByRole('button', { name: 'SAVE CHANGES' }).click();
    await expect(page).toHaveURL(new RegExp(`/marketplace/${saleId}(\\?.*)?$`));
    await expect(page.getByText('₹300').first()).toBeVisible();
  });

  test('a rental shows its unit and longest rental', async ({ page }) => {
    await login(page, 'A');
    rentId = await createListing(page, { title: rentTitle, price: 60, mode: 'rent', rentUnit: 'month', rentMax: 4 });
    await expect(page.getByText('per month')).toBeVisible();
    await expect(page.getByText('Rent for up to 4 months')).toBeVisible();
  });

  test('a rental with a bad longest-rental value is refused', async ({ page }) => {
    await login(page, 'A');
    await page.goto('/sell');
    await page.getByRole('button', { name: 'FOR RENT' }).click();
    await page.locator('#sell-title').fill(uniq('bad-rent'));
    await page.locator('#sell-price').fill('50');
    await page.locator('#sell-rent-unit').selectOption('month');
    await page.locator('#sell-rent-max').fill('13'); // months are limited to 12
    await page.getByRole('button', { name: 'POST LISTING' }).click();
    await expect(page.getByRole('alert')).toContainText(/longest rental/i);
    await expect(page).toHaveURL(/\/sell/);
  });

  test('a sold item leaves the default view and returns with "Include sold and rented"', async ({ page }) => {
    await login(page, 'A');
    await page.goto(`/marketplace/${saleId}`);
    await page.getByRole('button', { name: 'MARK AS SOLD' }).click();
    await expect(page.getByText('SOLD', { exact: true }).first()).toBeVisible();
    await page.goto(`/marketplace?q=${encodeURIComponent(saleTitle)}`);
    await expect(page.getByRole('link', { name: saleTitle })).toHaveCount(0);
    await page.goto(`/marketplace?q=${encodeURIComponent(saleTitle)}&available=all`);
    await expect(page.getByRole('link', { name: saleTitle }).first()).toBeVisible();
  });

  test('the "Include sold and rented" checkbox does the same', async ({ page }) => {
    await login(page, 'A');
    await page.goto(`/marketplace?q=${encodeURIComponent(saleTitle)}`);
    await page.getByLabel('Include sold and rented').check();
    await expect(page).toHaveURL(/available=all/);
    await expect(page.getByRole('link', { name: saleTitle }).first()).toBeVisible();
  });

  test('clean up', async ({ page }) => {
    await login(page, 'A');
    await deleteListing(page, saleId);
    await deleteListing(page, rentId);
  });
});

test.describe('wishlist', () => {
  test.skip(!have('A', 'B'), 'E2E_STUDENT_A_* and E2E_STUDENT_B_* not set');

  test('a student can save and remove a listing', async ({ browser }) => {
    const title = uniq('wish');
    const ctxA = await browser.newContext(); const a = await ctxA.newPage();
    await login(a, 'A');
    const id = await createListing(a, { title, price: 99 });

    const ctxB = await browser.newContext(); const b = await ctxB.newPage();
    await login(b, 'B');
    await b.goto(`/marketplace/${id}`);
    await b.getByRole('button', { name: 'Save to wishlist' }).click();
    await expect(b.getByRole('button', { name: 'Remove from wishlist' })).toBeVisible();
    await b.goto('/wishlist');
    await expect(b.getByRole('link', { name: title }).first()).toBeVisible();
    await b.getByRole('button', { name: 'Remove from wishlist' }).first().click();
    await b.reload();
    await expect(b.getByRole('link', { name: title })).toHaveCount(0);

    await deleteListing(a, id);
    await ctxA.close(); await ctxB.close();
  });
});
