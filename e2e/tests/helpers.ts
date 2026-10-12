import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { deflateSync } from 'node:zlib';

export type Who = 'A' | 'B' | 'MOD' | 'ADMIN';
const VARS: Record<Who, [string, string]> = {
  A: ['E2E_STUDENT_A_EMAIL', 'E2E_STUDENT_A_PASSWORD'],
  B: ['E2E_STUDENT_B_EMAIL', 'E2E_STUDENT_B_PASSWORD'],
  MOD: ['E2E_MODERATOR_EMAIL', 'E2E_MODERATOR_PASSWORD'],
  ADMIN: ['E2E_ADMIN_EMAIL', 'E2E_ADMIN_PASSWORD'],
};

export function creds(who: Who): { email: string; password: string } | null {
  const [e, p] = VARS[who];
  const email = process.env[e], password = process.env[p];
  return email && password ? { email, password } : null;
}
/** Use as `test.skip(!have('A', 'B'), 'accounts not configured')` so a missing account skips instead of failing. */
export const have = (...who: Who[]) => who.every((w) => creds(w) !== null);

export async function login(page: Page, who: Who) {
  const c = creds(who);
  if (!c) throw new Error(`No credentials configured for ${who}`);
  await page.goto('/login');
  await page.locator('#login-email').fill(c.email);
  await page.locator('#login-password').fill(c.password);
  await page.getByRole('button', { name: 'SIGN IN' }).click();
  await expect(page).toHaveURL(/\/marketplace/);
}

/** A fresh browser context signed in as `who` (so two people can act at the same time). */
export async function session(browser: Browser, who: Who): Promise<{ ctx: BrowserContext; page: Page }> {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await login(page, who);
  return { ctx, page };
}

export const uniq = (label: string) => `E2E ${label} ${Date.now().toString(36)}`;

// ---- a small valid PNG made on the fly (no binary file to keep in the repo) ----
function crc32(buf: Buffer): number {
  let c, crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
export function makePng(width = 64, height = 64): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4); ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB
  const row = Buffer.concat([Buffer.from([0]), Buffer.alloc(width * 3, 0x9a)]);
  const raw = Buffer.concat(Array.from({ length: height }, () => row));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

export interface NewListing { title: string; price: number; mode?: 'sell' | 'rent'; rentUnit?: 'day' | 'week' | 'month'; rentMax?: number }

/** Fills the sell form and posts it. Returns the new listing's id. */
export async function createListing(page: Page, l: NewListing): Promise<number> {
  await page.goto('/sell');
  if (l.mode === 'rent') await page.getByRole('button', { name: 'FOR RENT' }).click();
  await page.locator('#sell-title').fill(l.title);
  await page.locator('#sell-description').fill('Created by the automated browser tests.');
  await page.locator('#sell-price').fill(String(l.price));
  if (l.mode === 'rent' && l.rentUnit) await page.locator('#sell-rent-unit').selectOption(l.rentUnit);
  if (l.mode === 'rent' && l.rentMax) await page.locator('#sell-rent-max').fill(String(l.rentMax));
  await page.locator('#sell-photo').setInputFiles({ name: 'e2e.png', mimeType: 'image/png', buffer: makePng() });
  await expect(page.getByRole('button', { name: 'Change photo' })).toBeVisible(); // the preview appeared, so the photo was accepted
  await page.getByRole('button', { name: 'POST LISTING' }).click();
  await expect(page).toHaveURL(/\/marketplace\/\d+$/);
  return Number(new URL(page.url()).pathname.split('/').pop());
}

/** Deletes a listing as its owner. A listing that has chats cannot be deleted (a V2 rule), so staging data may keep a few. */
export async function deleteListing(page: Page, id: number) {
  await page.goto(`/marketplace/${id}`);
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'DELETE' }).click();
  await expect(page).toHaveURL(/\/marketplace$/);
}
