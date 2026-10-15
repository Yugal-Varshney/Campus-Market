# Phase 6 — usability, accessibility and polish

**App-only release: no SQL to run.** Deploy the ZIP, then follow the checks below. Nothing here could be tested in a browser or
on a phone where it was produced, so the visual and device checks at the end are yours to do.

## What changed
| Area | Change |
|---|---|
| Categories | The category list now comes from the database table (migration 008) instead of a fixed list in the code. The four built-in categories are the fallback if the table cannot be read. Posting, editing, filters, cards and listing pages all use the live list; a disabled category stays on old listings. |
| `/admin/categories` | Admins can add a category (name, short name, description), rename it, reorder it, and disable or enable it with a reason. A new category appears for students immediately. At least one category must stay active (database rule). |
| Filters | New "Include sold and rented" checkbox (the setting existed in the code but had no control). |
| Messages | The chat list is ordered by latest activity and shows a one-line preview ("You: …"). |
| Colour contrast | Measured against WCAG AA (4.5:1 for normal text): white text on the orange buttons was 4.34:1, orange text on the page background 4.14:1, and grey text on grey panels 4.11–4.32:1. The orange (`#cf4a1c` to `#c5461b`) and the grey text (`#6b6d7a` to `#656773`) were darkened just enough to pass everywhere (all pairs now 4.5:1 or better). The look is nearly unchanged. |
| Motion | Anyone who asks their device to reduce motion now gets no animations anywhere (previously only the splash). |
| Loading screens | Wishlist, profile and the sell form now show placeholders while loading. |
| Speed | The (now retired) splash background was a 174 KB WebP (was a 1.96 MB PNG). The old PNG is no longer used and can be deleted from `public/images/`. |
| Branding | The site, README and package name now say "Campus Market" (the old text said "IIPS Market"). |

## Deploy
1. Copy the ZIP over your project, `npm ci`, `npm test`, `npm run build`, push.
2. The splash image changed name (`cmbg.webp`); make sure the new file is committed.
3. `package-lock.json` only had its `name` field changed; `npm ci` should behave as before. If it complains, run `npm install` once and commit the lockfile.

## Checks for you (about 20 minutes)
1. **Categories (admin):** `/admin/categories` → add "Lab Equipment" → open `/sell`: the new category is in the dropdown. Post a listing in it → it shows "Lab Equipment" on the card. Disable it → it disappears from `/sell` and the filter, the old listing keeps its label, and editing that listing still works.
2. **Sold items filter:** mark a listing sold, then tick "Include sold and rented" in the marketplace filters → it appears; untick → it disappears.
3. **Messages:** send a message in an older chat → that chat moves to the top, with a preview line.
4. **Phone width (375 px, or Chrome DevTools → device toolbar):** home, marketplace (search box visible, filters usable), a listing page, chat, sell form, `/moderator`. Nothing should scroll sideways except the staff tables.
5. **Keyboard only:** press Tab through the marketplace, a listing page and the sell form. Every control must show a visible outline and be reachable; the "Skip to content" link appears on the first Tab.
6. **Reduced motion:** turn on "Reduce motion" in your phone or computer settings → the splash and card animations stop.
7. **Screen reader (optional):** NVDA (Windows) or VoiceOver (Mac/iPhone) on the sell form and a chat; buttons and fields should be announced with sensible names.

## Not done (and why)
- **Unread-message indicators** need a new table in the database to remember what each person has read, so they are planned as a database change, not a polish item.
- **Font loading:** fonts still come from Google Fonts through a link; switching to Next's built-in font loader changes every font variable in the stylesheet and could not be test-built here.
- **Automated accessibility scan** (Lighthouse/axe) was not run; the contrast numbers above are calculated from the colour values, not measured in a browser.
