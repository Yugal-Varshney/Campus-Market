import { expect, test } from '@playwright/test';
import { createListing, creds, have, session, uniq } from './helpers';

test.describe('seller-consent contact sharing', () => {
  test.skip(!have('A', 'B'), 'E2E_STUDENT_A_* and E2E_STUDENT_B_* not set');

  test('contact details stay private until the seller approves, and can be withdrawn', async ({ browser }) => {
    const title = uniq('consent');
    const seller = await session(browser, 'A');
    const buyer = await session(browser, 'B');
    const id = await createListing(seller.page, { title, price: 120 });

    // Buyer: opens the listing. There is no direct "contact seller" any more, only a chat.
    await buyer.page.goto(`/marketplace/${id}`);
    await expect(buyer.page.getByRole('button', { name: 'VIEW CONTACT DETAILS' })).toHaveCount(0);
    await buyer.page.getByRole('button', { name: 'CHAT WITH SELLER' }).click();
    await expect(buyer.page).toHaveURL(/\/messages\?c=\d+/);
    await buyer.page.getByRole('button', { name: 'ASK FOR CONTACT DETAILS' }).click();
    await expect(buyer.page.getByText(/Request sent/)).toBeVisible();

    // Seller: sees the request in the chat and approves it.
    await seller.page.goto('/messages');
    await seller.page.getByText(title).first().click();
    await expect(seller.page.getByText(/asked you to share your college email and phone number/)).toBeVisible();
    await seller.page.getByRole('button', { name: 'APPROVE' }).click();
    await expect(seller.page.getByText(/You are sharing your contact details/)).toBeVisible();

    // Buyer: can now see the seller's email.
    await buyer.page.reload();
    await buyer.page.getByRole('button', { name: 'VIEW CONTACT DETAILS' }).click();
    await expect(buyer.page.getByText(creds('A')!.email)).toBeVisible();

    // Seller withdraws; the buyer can no longer open the details.
    await seller.page.getByRole('button', { name: 'STOP SHARING' }).click();
    await buyer.page.reload();
    await expect(buyer.page.getByRole('button', { name: 'VIEW CONTACT DETAILS' })).toHaveCount(0);
    await expect(buyer.page.getByText(creds('A')!.email)).toHaveCount(0);

    await seller.ctx.close(); await buyer.ctx.close();
  });

  test('a declined request cannot be repeated straight away', async ({ browser }) => {
    const title = uniq('decline');
    const seller = await session(browser, 'A');
    const buyer = await session(browser, 'B');
    const id = await createListing(seller.page, { title, price: 80 });

    await buyer.page.goto(`/marketplace/${id}`);
    await buyer.page.getByRole('button', { name: 'CHAT WITH SELLER' }).click();
    await buyer.page.getByRole('button', { name: 'ASK FOR CONTACT DETAILS' }).click();
    await seller.page.goto('/messages');
    await seller.page.getByText(title).first().click();
    await seller.page.getByRole('button', { name: 'DECLINE' }).click();

    await buyer.page.reload();
    await expect(buyer.page.getByText(/chose not to share/)).toBeVisible();
    await buyer.page.getByRole('button', { name: 'ASK FOR CONTACT DETAILS' }).click();
    await expect(buyer.page.getByRole('alert')).toContainText(/24 hours/);

    await seller.ctx.close(); await buyer.ctx.close();
  });
});
