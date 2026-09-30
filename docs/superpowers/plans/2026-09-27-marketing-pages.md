# Marketing content pages (About, FAQ, Contact, Blog, Legal) — plan

Spec §6 of `docs/superpowers/specs/2026-09-27-marketing-site-redesign-design.md`; prototype templates `PAGES.about|faq|contact|blog` in `assets/landing-redesign/app.js`. All CSS already lives in `app/(marketing)/marketing.css`; small extras go in `app/(marketing)/styles/pages.css` (scoped `.mkt`).

## Pure helpers (TDD, `lib/marketing/pages/__tests__`)
- `lib/marketing/pages/list.ts` — `joinNames(names, locale)`: "A, B and C" / "A, B y C" (no Oxford comma in either language).
- `lib/marketing/pages/faq.ts` — `buildFaq({ t, locale, prices, instrumentKeys })` → `{ id, title, items: { q, a }[] }[]`. Prices are `formatCents` strings interpolated into `marketing.site.faq.*` templates; instruments are the live catalog keys → `instrumentLabel` → `joinNames`. Empty catalog → a "not yet published" answer.
- `lib/marketing/pages/contact.ts` — `CONTACT_TOPICS` (key → API subject, the five whitelisted subjects) and `validateContact(values)` → `{ field: errorKey }` (name ≥2, email regex same as API, topic in whitelist, message ≥10 trimmed).
- `lib/marketing/pages/blog.ts` — `parsePostBody(content)` → blocks (`h2` / `ol` / `p`, each with `**bold**` inline runs), extracted verbatim from the current `[slug]` renderer; `readingMinutes(content)` (same formula as today); `postCategories(posts)` (distinct, first-seen order over newest-first posts).

## Components (`components/marketing/pages/`)
- `AboutVideo` (client, `useInViewVideo`), `FaqNav` (client, smooth-scroll jump links honouring reduced motion), `ContactForm` (client: name/email/topic chips/message, inline field errors with `aria-invalid`/`aria-describedby`, POST JSON `{name,email,subject,message}` to `/api/contact`, visible error on non-OK/network failure, success state), `CopyEmail` (client: clipboard, select-text fallback), `BlogBrowser` (client: category chips + grid), `PostCover` (server-safe: `next/image` from `cover_image_url` else `Sleeve` seeded by slug), `PostBody` (renders `parsePostBody` blocks), `NewsletterSignup` (client-only, same behaviour as today: local "subscribed" state, no network).
- `components/marketing/legal-page.tsx` rewritten: `PageHead` (crumbs Home / title, dates in the lede) + `.legal-prose` 68ch column. Same props, so the three legal pages keep their text untouched.

## Routes
- `/about` server: PageHead, video + manifesto + mission prose, three values, numbers from `getMarketingCatalog(locale).counts`, `<Finale/>` with about title.
- `/faq` server: PageHead, `faq-grid` with `FaqNav` + `<details class="qa">` (first open).
- `/contact` server: PageHead, `contact-grid` with `ContactForm` and side cards (email + CopyEmail, response time, socials from `SOCIAL`).
- `/blog` server: fetch published posts newest first → feature card, `BlogBrowser`, newsletter, empty state.
- `/blog/[slug]` server: keep `generateMetadata`; PageHead (crumbs, title, category · date · author · read time), cover, `.mkt` prose body, tags, related (same category, else latest), `<Finale/>`.
- Metadata localized via `generateMetadata` + `getServerTranslator`.

## Locales
Keys under `marketing.site.{about,faq,contact,blog,legal}` above the `_` sentinel, inserted by a small script (text insertion, then `JSON.parse` check).

## Verification
tsc, full vitest, eslint on touched files, headless screenshots of every route at 1440×900 and 390×844 (port 3025), scrollWidth check, code review.
