# UX Phase 5: validating the experience

This is the checklist for the part a test script cannot do: using the site like a student. Automated checks live in
`e2e/tests/experience.spec.ts`, `a11y.spec.ts` and `mobile.spec.ts`; run them against a **preview** URL (see `e2e/.env.example`).
Allow about 90 minutes for a full pass.

## 1. Devices to try (tick each row for every flow in section 2)

| Device | Browser | Why |
| --- | --- | --- |
| A mid-range Android phone | Chrome | Most students. Try it on mobile data, not just Wi-Fi |
| An iPhone | Safari | Safari handles share sheets, file pickers and `100vh` differently |
| A laptop, 1280 px wide | Chrome | The default desktop view |
| A laptop window dragged to about 800 px | Any | The tablet width, where the filters change layout |
| Any phone | Firefox or Samsung Internet | Optional, quick pass only |

## 2. Flows to walk through (as a student with two accounts, A and B)

1. **First visit.** Open the site signed out. The homepage shows within a couple of seconds, with no splash delay. Search from the hero.
2. **Browse.** Tap a category chip. The results change, the chip is highlighted, a pill appears. Remove the pill. Open Filters on a phone.
3. **No results.** Search for nonsense. The page says what it searched for and offers "Clear filters".
4. **Sell (account A).** Open Sell, tap Post with nothing filled in: focus moves to the first problem and the message sits next to it.
   Fill it in: watch the live preview change. Post it. You should land on the listing with the "live" banner and share buttons.
5. **Contact (account B).** On that listing tap a quick message. You arrive in the chat with the message sent.
   Ask for contact details, approve as A, then check Call, WhatsApp and Copy on B's side.
6. **Save a search (account B).** Search for a word nobody has listed yet, tap Save this search. As A, post something matching it.
   As B, the Alerts icon shows a badge. Open Saved searches, tap SEE NEW. The badge clears.
7. **Share.** On a phone, tap Share on a listing and send it to yourself. Open it in a private tab: you land on sign-in, then on the listing.
8. **Clean up.** Delete the test listings and the saved search.

## 3. Keyboard only (no mouse, laptop)

- Press Tab from the top of the page. First stop is "Skip to content". Enter jumps past the navbar.
- You can see where focus is at every step on: home, marketplace, a listing, Sell, Messages, Saved searches.
- Category chips, filter checkboxes, the price slider (arrow keys), sort menu, pagination, Save search, Share, quick messages all work with Tab, Space and Enter.
- Submitting the Sell form with an error moves focus to the field with the error.
- Nothing traps focus. Escape closes the account menu.

## 4. Loading and error states

| Try | Expect |
| --- | --- |
| Chrome DevTools, Network, "Slow 4G", reload the marketplace | Skeleton cards show, nothing jumps when listings arrive |
| DevTools, Network, "Offline" | A dark "You're offline" bar. Tapping Save or Send shows a message instead of a crash. Bar disappears when back online |
| Open `/marketplace/999999999` | "Listing not found" with a button back |
| Stop the Supabase project (staging) or break the URL in preview env vars | Pages show "didn't load" with Try again, navbar still visible |
| Upload a 10 MB photo or a PDF renamed to .jpg | A clear message next to the photo, form keeps what you typed |

## 5. What to measure once real students use it

Open **Admin, Usage** (`/admin/usage`). It needs migration 013. Look at it weekly, with the 30-day view, and compare with the previous period shown under each number.

| Question | Where to look | A healthy sign |
| --- | --- | --- |
| Are people joining and coming back? | New students, Active students | Active students grows faster than it flattens |
| Is there enough to buy? | Listings posted, Listings with no chat after 14 days | Fewer than about 1 in 3 active listings are stale |
| Do conversations happen? | Chats started, Chats the seller answered | Over 70% answered. Lower means sellers are not seeing messages: consider email alerts |
| Is the consent flow too strict? | Contact requests approved | Over 60% approved |
| Are alerts and saved searches used? | Searches saved | Some every week once the feature is announced |
| Does it actually sell? | Sold or rented, all time | Rising week on week |

What it cannot tell you: page views, how many people left without doing anything, and which searches found nothing. To see those, add
Vercel Web Analytics (free tier gives page views and visitors, no cookies) and later log searches that return zero results.

## 6. Before you call a phase done

- [ ] `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` pass
- [ ] Migrations 012 and 013 ran on the live database before the matching deploy
- [ ] E2E suite passes against a preview URL
- [ ] Sections 2, 3 and 4 ticked on at least one phone and one laptop
