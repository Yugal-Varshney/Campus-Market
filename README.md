<div align="center">

# 🎓 Campus Market

### Your campus. Your community. A smarter way to buy, sell, and rent.

A student-focused marketplace for finding second-hand textbooks, class notes, electronics, stationery, and other campus essentials — all in one place.

[Explore the repository](https://github.com/Yugal-Varshney/Campus-Market) · [Report a bug](https://github.com/Yugal-Varshney/Campus-Market/issues)

![Next.js](https://img.shields.io/badge/Next.js-15-black?logo=nextdotjs&logoColor=white)
![React](https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript&logoColor=white)
![Supabase](https://img.shields.io/badge/Backend-Supabase-3ECF8E?logo=supabase&logoColor=white)
![Deploy](https://img.shields.io/badge/Deploy-Vercel-black?logo=vercel&logoColor=white)

</div>

---

## ✨ Why Campus Market?

Campus life comes with a lot to buy — and plenty of things students no longer need. Campus Market helps students give useful items a second life, discover affordable essentials, and connect with other students.

- **Buy smarter:** discover useful items listed by fellow students.
- **Sell what you no longer need:** create listings with photos and pricing.
- **Rent when ownership isn't necessary:** list or find items for temporary use.
- **Connect in one place:** message sellers and manage conversations without sharing contact details by default.

> **Built for campus life:** practical listings, student-focused access, and a marketplace designed around trust and usability.

## 🧭 Features at a glance

| Feature | What you can do |
| --- | --- |
| 🔐 Accounts | Register, confirm your email, sign in, sign out, and reset your password. |
| 🛍️ Marketplace | Browse listings with search, category and price filters, sorting, and pagination. |
| 📚 Sell & rent | Publish items with photos, descriptions, condition, and pricing. Rental listings can specify a price unit and a maximum rental duration. |
| 🧰 Listing management | Edit your listings and mark items as sold or rented. |
| 💛 Wishlist | Save listings you want to revisit. |
| 💬 Private conversations | Chat with buyers and sellers using Supabase Realtime. |
| 🤝 Contact consent | Request contact details through a consent flow; sellers can approve or decline. |
| 🚩 Reporting | Report listings or users for review. |
| 🛡️ Moderation tools | Staff workflows for reports, listing actions, account restrictions, and audit history. |
| 🗂️ Category management | Admin tools for managing marketplace categories. |

Some features depend on the matching Supabase migrations and production configuration being applied. See the setup and deployment notes below before launching a new environment.

## 🧱 Tech stack

- **Framework:** Next.js App Router
- **UI:** React + TypeScript
- **Backend services:** Supabase Auth, PostgreSQL, Storage, and Realtime
- **Database security:** PostgreSQL Row Level Security (RLS), constraints, triggers, and guarded database functions
- **Deployment:** Vercel
- **Automated checks:** TypeScript, Node-based tests, database tests, Playwright end-to-end tests, and GitHub Actions CI

## 🏗️ How it fits together

```text
Student's browser
      │
      ▼
Next.js App Router
  ├── Server Components ── read marketplace data
  ├── Server Actions ───── validate and perform mutations
  ├── Middleware ───────── session and route handling
  └── Client UI ────────── interactive forms and live chat
      │
      ▼
Supabase
  ├── Auth ─────────────── account sessions and email confirmation
  ├── PostgreSQL ───────── listings, profiles, wishlists, messages, reports
  ├── Row Level Security ─ data access enforcement
  ├── Storage ──────────── listing images
  └── Realtime ─────────── chat updates
```

The application is designed to use the signed-in user's session for database access so database policies can enforce permissions. **Never put a Supabase service-role key in browser code or expose it through a `NEXT_PUBLIC_` variable.**

## 🚀 Run locally

### 1. Prerequisites

- Node.js **22** (the repository pins this in `.nvmrc`)
- npm
- A Supabase project with access to its SQL Editor and Authentication settings

### 2. Install dependencies

```bash
git clone https://github.com/Yugal-Varshney/Campus-Market.git
cd Campus-Market
npm ci
```

### 3. Configure environment variables

Copy `.env.example` to `.env.local` and replace the placeholders with your Supabase project values.

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
NEXT_PUBLIC_SITE_URL=http://localhost:3000
REQUIRE_LOGIN_TO_BROWSE=true
```

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase publishable/anon key used by the app. Configure database policies correctly; this key is not a substitute for RLS. |
| `NEXT_PUBLIC_SITE_URL` | Base site URL used when generating authentication links. |
| `REQUIRE_LOGIN_TO_BROWSE` | Set to `true` to require login to browse, or `false` to allow public browsing. |
| `SUPABASE_SERVICE_ROLE_KEY` | Not used by the current application. Leave unset unless the code and deployment plan explicitly require it; never expose it to the browser. |

**Keep `.env.local` private.** Do not commit real credentials. `.env.example` is a template and should contain placeholders only.

### 4. Set up the database

Database migrations are **not applied automatically** by starting the app. Before using a fresh Supabase project:

1. Back up any existing database before making schema changes.
2. Open **Supabase → SQL Editor** and follow the repository's migration runbooks.
3. Start with migrations `001`–`003` in order. Read the output of `001_initial_review.sql` carefully; it is an audit step.
4. Follow [`docs/V3_MIGRATION_RUNBOOK.md`](docs/V3_MIGRATION_RUNBOOK.md) for migrations `004`–`009`, including the preflight audit and post-migration verification.
5. Follow [`docs/PHASE4_RUNBOOK.md`](docs/PHASE4_RUNBOOK.md) for migrations `010`–`011` and the contact-consent/rental updates.
6. Run the relevant SQL verification scripts under `supabase/verification/` and resolve failures before deploying.

Do not blindly run production migrations: read each runbook, review audit results, and make sure you understand the expected changes first.

### 5. Configure authentication

In **Supabase → Authentication → URL Configuration**, add your local callback URL:

```text
http://localhost:3000/auth/callback
```

Add your deployed site's callback URL as well. Keep email confirmation enabled for production. The app checks college-style email formats, but **format validation alone does not prove that someone belongs to a particular college**. Configure `public.allowed_email_domains` with your institution's real domains if your database migrations use that allow-list. See the security notes in the migration/runbook documentation.

### 6. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## 🧪 Quality checks

Run these before opening a pull request or deploying:

```bash
npm test
npm run typecheck
npm run lint
npm run build
```

Database tests are available separately and require Python plus a local PostgreSQL test setup as described in the repository's test documentation:

```bash
npm run test:db
```

Browser-based end-to-end tests live in `e2e/`. Their configuration and staging requirements are documented in [`docs/PHASE7_RUNBOOK.md`](docs/PHASE7_RUNBOOK.md) and [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md).

For a security-focused manual verification checklist, see [`docs/SECURITY_TESTS.md`](docs/SECURITY_TESTS.md).

## ☁️ Deploy to Vercel

1. Push the project to GitHub and import the repository into Vercel.
2. Set the required environment variables for **Preview** and **Production** environments.
3. Set the Vercel Node.js version to **22.x** to match `.nvmrc`.
4. Confirm the Supabase schema migrations and verification checks are complete.
5. Add the deployed site's `/auth/callback` URL to Supabase's allowed redirect URLs.
6. Deploy, then test registration, email confirmation, login, password reset, listing creation, image uploads, chat, and role-protected pages in the deployed environment.

The app's image configuration reads the Supabase project hostname from `NEXT_PUBLIC_SUPABASE_URL`. Image uploads and server-action payloads have size limits; keep images reasonably sized and use the existing image-compression flow.

## 🔒 Security principles

- **RLS stays enabled:** database policies are a core part of access control.
- **User identity is database-verified:** sensitive ownership fields should not be trusted from client-submitted values.
- **Private contact information:** contact details are handled separately and shared through the consent workflow.
- **Restricted staff actions:** moderation and admin permissions must be enforced by the database as well as by the UI.
- **Safe uploads:** image type, size, and ownership restrictions should remain enabled.
- **No secrets in Git:** use local environment files and Vercel environment settings for configuration.

For exact policy behavior and migration requirements, the SQL and runbooks are the source of truth. Review [`docs/SECURITY_TESTS.md`](docs/SECURITY_TESTS.md) before a production release.

## 🗺️ Project structure

```text
app/                  App Router pages, layouts, and route handlers
components/           Marketplace UI, forms, chat, account, and staff components
lib/                  Supabase clients, auth, listings, messages, validation, moderation
supabase/migrations/  Ordered database migrations
supabase/verification/ SQL verification checks
supabase/tests/       Local database tests
tests/                Application-level tests
e2e/                  Playwright end-to-end tests
docs/                 Setup, migration, release, and security runbooks
types/                Database and application types
public/               Static assets and demo listing images
```

## 📚 Useful documentation

- [V3 database migration runbook](docs/V3_MIGRATION_RUNBOOK.md)
- [V4 feature and deployment runbook](docs/PHASE4_RUNBOOK.md)
- [Moderator and admin setup](docs/PHASE5_RUNBOOK.md)
- [Usability and category management](docs/PHASE6_RUNBOOK.md)
- [Testing and CI runbook](docs/PHASE7_RUNBOOK.md)
- [Test plan](docs/TEST_PLAN.md)
- [Security test checklist](docs/SECURITY_TESTS.md)
- [Design notes](docs/V3_DESIGN.md)

## 🤝 Contributing

Contributions, bug reports, and thoughtful suggestions are welcome.

1. Check existing issues before starting a large change.
2. Create a focused branch for your work.
3. Keep changes small and preserve existing security checks and database behavior.
4. Run the quality checks listed above.
5. Open a pull request describing the change, the reason for it, and how it was tested.

If a change requires a database update, include a migration, verification steps, and a clear rollback or recovery note where appropriate.

## 📄 License

No license file was identified in the project archive. Until a license is added to the repository, assume that the project is **not explicitly licensed for reuse or redistribution**.

---

<div align="center">

**Made for student communities. ♻️ Built to keep useful things in circulation.**

</div>
