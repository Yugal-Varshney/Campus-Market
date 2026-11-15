# Campus Market

A marketplace where students can buy, sell and rent second-hand things on campus: textbooks, notes, electronics and stationery.

Built with Next.js, React, TypeScript and Supabase. Live at https://campus-market-v2.vercel.app

## Features

- Sign up with a college email, log in, log out, reset password
- Browse listings with search, category and price filters, sorting and pagination
- Post items for sale or rent, with photos; edit them and mark them sold or rented
- Rental listings have a price per day, week or month and a maximum rental period
- Wishlist and saved searches
- Chat between buyer and seller
- Seller contact details (email, phone) are shown only after the seller approves a request
- Report a listing or a user
- Moderator and admin pages: reports, hiding listings, restricting accounts, categories, audit log, usage numbers

## Tech stack

- Next.js (App Router), React 19, TypeScript
- Supabase: Auth, PostgreSQL with Row Level Security, Storage, Realtime
- Deployed on Vercel

## Run it locally

You need Node.js 22 and a Supabase project that has the migrations applied (see `docs/setup.md`).

```bash
npm install
cp .env.example .env.local     # then fill in the Supabase URL and anon key
npm run dev
```

Open http://localhost:3000.

For a ready-made login to try the app, see `testuserloginReadme.md`.

## Environment variables

| Name | What it is |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key |
| `NEXT_PUBLIC_SITE_URL` | Site address used in email links. `http://localhost:3000` locally |
| `REQUIRE_LOGIN_TO_BROWSE` | `true` to require login before browsing, `false` to let anyone browse |

## Deploying to Vercel

1. Push to GitHub and import the repo in Vercel.
2. Add the environment variables above.
3. Set the Node version to 22.x.
4. Add the site's `/auth/callback` URL in Supabase (Authentication -> URL Configuration).

## Folder structure

```
app/          pages, layouts and route handlers
components/   UI components (forms, chat, marketplace, staff)
lib/          Supabase clients, auth, listings, messages, validation
supabase/     migrations, verification queries, test account, local DB tests
tests/        unit tests
e2e/          Playwright browser tests
docs/         setup notes
public/       images
```

## Scripts

```bash
npm run dev         # start dev server
npm run build       # production build
npm test            # unit tests
npm run typecheck
npm run lint
```
