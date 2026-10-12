import { expect, test } from '@playwright/test';
import { createListing, have, session, uniq } from './helpers';

test.describe('reporting and moderation', () => {
  test.skip(!have('A', 'B', 'MOD'), 'E2E_STUDENT_A_*, E2E_STUDENT_B_* and E2E_MODERATOR_* not set');

  test('a report travels from a student to a moderator, who can hide and restore the listing', async ({ browser }) => {
    const title = uniq('report');
    const seller = await session(browser, 'A');
    const buyer = await session(browser, 'B');
    const mod = await session(browser, 'MOD');
    const id = await createListing(seller.page, { title, price: 75 });

    // Student reports the listing, and cannot report it twice.
    await buyer.page.goto(`/marketplace/${id}`);
    await buyer.page.getByRole('button', { name: 'Report this listing' }).click();
    await buyer.page.getByLabel('What is wrong?').selectOption('scam');
    await buyer.page.getByRole('button', { name: 'SEND REPORT' }).click();
    await expect(buyer.page.getByText('Thanks. A moderator will review your report.')).toBeVisible();

    // Moderator finds it in the queue and works it.
    await mod.page.goto('/moderator');
    await mod.page.getByRole('row', { name: new RegExp(title) }).getByRole('link').first().click();
    await expect(mod.page.getByText('REPORT #')).toBeVisible();
    await mod.page.getByRole('button', { name: 'CLAIM REPORT' }).click();
    await expect(mod.page.getByText('Report claimed')).toBeVisible();
    await mod.page.getByLabel(/^Reason/).fill('Automated test: hiding to verify moderation.');
    mod.page.once('dialog', (d) => d.accept());
    await mod.page.getByRole('button', { name: 'HIDE LISTING' }).click();
    await expect(mod.page.getByText(/Listing hidden/)).toBeVisible();

    // A hidden listing is gone for other students.
    const res = await buyer.page.goto(`/marketplace/${id}`);
    expect(res?.status()).toBe(404);

    // Moderator restores it and closes the report.
    await mod.page.getByLabel(/^Reason/).fill('Automated test: restoring.');
    await mod.page.getByRole('button', { name: 'RESTORE LISTING' }).click();
    await expect(mod.page.getByText('Listing restored.')).toBeVisible();
    await mod.page.getByLabel(/^Reason/).fill('Automated test: closing the report.');
    await mod.page.getByRole('button', { name: 'RESOLVE' }).click();
    await expect(mod.page.getByText('Report resolved.')).toBeVisible();
    const back = await buyer.page.goto(`/marketplace/${id}`);
    expect(back?.status()).toBeLessThan(400);

    await seller.ctx.close(); await buyer.ctx.close(); await mod.ctx.close();
  });

  test('a student cannot report their own listing', async ({ browser }) => {
    const seller = await session(browser, 'A');
    const id = await createListing(seller.page, { title: uniq('own-report'), price: 10 });
    await seller.page.goto(`/marketplace/${id}`);
    await expect(seller.page.getByRole('button', { name: 'Report this listing' })).toHaveCount(0);
    await seller.ctx.close();
  });
});
