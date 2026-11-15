# Campus Market – Login & Local Setup (Requires link to supabase)

## Demo account

|              |                         |
| ------------ | ----------------------- |
| **Email**    | `testuser@dauniv.ac.in` |
| **Password** | `testuser123`           |

This is a normal student account (it can browse, list items, message, wishlist). It is not an admin or moderator.

## Run it locally (about 5 minutes)

You need **Node.js 22** (https://nodejs.org) and an internet connection (the app uses an online Supabase database, so the same demo account works locally and on the deployed site).

1. Open a terminal in this project folder.
2. Install: `npm install`
3. Create the settings file: copy `.env.example` to **`.env.local`**, then fill in the two Supabase values you were given :
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   REQUIRE_LOGIN_TO_BROWSE=true
   ```
4. Start: `npm run dev`
5. Open http://localhost:3000 and sign in with the account above.

If a page says **"Campus Market needs its settings"**, step 3 is missing or still has placeholder text; fix `.env.local` and restart `npm run dev`.

## Deployed site

Sign in at https://campus-market-v2.vercel.app with the same email and password.
