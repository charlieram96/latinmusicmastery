# Marketing Site Redesign ("Noche") — Design

**Date:** 2026-09-27
**Routes:** everything under `app/(marketing)/`: `/`, `/explore`, `/explore/[countrySlug]`, `/explore/[countrySlug]/[styleSlug]`, `/course-preview/[courseId]`, `/instructors`, `/instructors/[teacherId]` (new), `/playsense`, `/pricing`, `/about`, `/faq`, `/contact`, `/blog`, `/blog/[slug]`, `/privacy`, `/terms`, `/accessibility`.
**Status:** Approved by the user over five rounds of review (2026-09-26 → 2026-09-27). The user asked for implementation without a further checkpoint.
**Prototype of record:** https://claude.ai/artifact/4XBE9o4U5fSGwcAQ9UEVbw (version 5). The source is committed at `docs/superpowers/specs/assets/landing-redesign/`: `body.html` (home markup), `style.css` + `pages.css` (every style rule), `app.js` (every interaction plus the page templates for the other pages). **Port from these files.** Their class names, sizes, colours, easing and copy are the design. Where this spec and the prototype disagree, this spec wins.

## Goal

Replace the template-looking marketing site with a distinctive, cinematic site built around Latin music's own material: the clave, the salsa orchestra's stage plot, record-sleeve covers, and the real PlaySense Miami stage. The user asked for "outrageous production value", then asked for it to be toned down. The approved level is the prototype's v5: rich and detailed, but calm. Nothing moves to a beat unless the visitor presses play.

## Locked decisions

The user made these calls during review. Later work must not reopen them.

- **Single dark look ("Noche").** Marketing pages ignore the app's light/dark toggle. There is no theme toggle in the marketing header. The dashboard's Studio Amber theme and its toggle are untouched.
- **Hero:** big display headline on the left. On the right, the band video (`/videos/hero-video-final.mp4`) is shown inside **three horizontal white piano keys**, with two black keys between them (the C–D–E group). Keys fade into shadow at the back, sit on tight seams, and have near-square fronts and a front lip. There is **no fallboard bar and there are no note labels**. The only overlay is the Patricio “El Chino” Díaz glass chip. Keys press in a slow staggered cycle, the group tilts toward the cursor on desktop, and clicking a key plays its note (C4, C♯4, D4, D♯4, E4).
- **No spinning clave clock anywhere.** The groove lives in its own home section as a still 5×16 step grid (clave, campana, conga, bass, piano). It animates only while playing. Tapping a row name mutes it; tapping a cell edits the pattern.
- **Stage plot does not pulse.** Twelve seats. The sax sits inside the dashed apron line.
- **PlaySense is shown as the real Miami bayfront stage** (skyline, pier, palms, fireworks, conga pads): never a mock highway, never a spinning thing.
  - The home and course pages use a **recorded clip** of the stage with an HTML HUD mirroring the app.
  - The `/playsense` page embeds the **live `StageHighway`** in demo mode (see §6), with the clip as poster/fallback.
  - The staff workspace (lesson video + notation) appears only as a secondary "Prefer the chart?" section on `/playsense`.
- **No fabricated content.** No testimonials section (the current ones look invented). Blog shows real `blog_posts` or an empty state. Every count (courses, maestros, instruments, styles, countries) is computed from the database at request time.
- **Fonts:** Big Shoulders Display 700/800/900 (display, uppercase), Instrument Serif italic (Spanish flourishes and the second line of headings), Hanken Grotesk 400/500/600 (body), DM Mono 400/500 (eyebrows, counts, data). They are loaded only for marketing routes.
- **Bilingual.** Every visible string goes through the existing i18n system (`locales/en.json` + `locales/es.json`). The prototype's `data-es` attributes hold the approved Spanish copy for the home page. Other pages need Spanish written to the same standard.
- **Waitlist is the primary call to action** everywhere ("Save my seat" / "Reserva tu lugar"). It keeps the existing server action and details modal.

## 1. Foundations

### 1.1 Tokens and scoping
- New stylesheet `app/(marketing)/marketing.css`, imported by `app/(marketing)/layout.tsx`.
- Every rule is scoped under `.mkt`, a wrapper `div` rendered by the layout, so nothing leaks into the app. The body background on marketing routes is also painted by `.mkt` (min-height 100vh).
- Tokens (from `style.css :root`), declared on `.mkt`:
  - `--noche:#100A13` `--noche-2:#170F1B` `--noche-3:#211625` `--noche-4:#2C1E31`
  - `--line:rgba(246,235,221,.09)` `--line-2:rgba(246,235,221,.16)`
  - `--hueso:#F6EBDD` `--humo:#B7A7AE` `--humo-2:#85747D`
  - `--ambar:#FFA524` `--carmin:#FF324D` `--grad:linear-gradient(100deg,#FFA524 0%,#FF6A3A 45%,#FF324D 100%)`
  - instrument colours `--i-clave:#F6EBDD` `--i-campana:#FFC94D` `--i-conga:#FF5A48` `--i-bajo:#2FD1B5` `--i-piano:#A58BFF`
  - semantic `--ok:#2FD1B5` `--late:#FFC94D`
  - `--ease-out:cubic-bezier(.16,1,.3,1)`
  - `--gut:clamp(16px,4vw,56px)` `--max:1440px`
- **Class collisions.** `app/globals.css` and shadcn define generic names. Before using a prototype class name, grep for it. The prototype names `btn`, `chip`, `field`, `lede`, `wrap`, `sec`, `key` are all acceptable only under `.mkt`. `color-scheme: dark` is set on `.mkt`.
- **Tailwind** stays available but is not required. Port the prototype's CSS as plain CSS. That keeps it reviewable against the source of record.

### 1.2 Fonts
`lib/marketing/fonts.ts` uses `next/font/google`:
- `Big_Shoulders_Display({ subsets:['latin'], weight:['700','800','900'], variable:'--f-display', display:'swap' })`
- `Instrument_Serif({ subsets:['latin'], weight:'400', style:'italic', variable:'--f-serif', display:'swap' })`
- `Hanken_Grotesk({ subsets:['latin'], weight:['400','500','600'], variable:'--f-body', display:'swap' })`
- `DM_Mono({ subsets:['latin'], weight:['400','500'], variable:'--f-mono', display:'swap' })`

The layout applies the four `.variable` classes to the `.mkt` wrapper. The `--f-*` fallback stacks in `marketing.css` mirror the prototype. The global `h1..h6 { font-family: Montserrat }` rule must be overridden inside `.mkt`.

### 1.3 Shell
- **`SiteHeader`** (client).
  - Fixed. Transparent until 24px of scroll, then `rgba(16,10,19,.72)` with an 18px blur and a bottom line.
  - Left: logo mark (the three-path gradient SVG from `body.html`) plus the "Latin Music / MASTERY" wordmark.
  - Nav: Explore · Instructors · PlaySense · Pricing · About. The current page is highlighted by pathname prefix.
  - Right: an EN/ES segmented switch that calls `setLocale` from `useTranslation`, then "Join the waitlist", which links to `#join` on `/` or scrolls to the page's own `#join` when one exists.
  - Below 1100px the nav collapses to a menu button that opens a full-screen sheet with the same links. Below 640px the CTA hides.
  - Keep the Explore dropdown data (`getNavCatalog`)? No. Explore is a single link, and the explore page has the filters.
- **`SiteFooter`** (server). Brand block, then three link columns (Platform, Company, Follow), then a base row: "© {year} Latin Music Mastery" · "Made in clave 3-2" / "Hecho en clave 3-2". Social links reuse `socialLinks` from `components/marketing/SocialLinks.tsx`. Legal links: Privacy, Terms, Accessibility.
- **`Grain`.** A fixed noise overlay at opacity .07, static (not animated). It is hidden under reduced motion.
- **`Reveal`** (client). Wraps a block and adds `.in` on first intersection. The resting state before reveal is `translateY(46px)`, `opacity:.3`, `blur(3px)`, never `opacity:0`. It does nothing under reduced motion.
- **`PageHead`** (server). The sub-page hero from `phead()` in `app.js`: breadcrumbs, a giant title whose second phrase is serif italic gradient, a lede, and an optional extra slot, over two soft light beams.
- **`Sleeve`.** The record-sleeve cover from `sleeve()` in `app.js`: a deterministic palette and motif from a seed string, a title, and corner labels.
- **`WaitlistSignup`** (client). The pill email field plus "Save my seat". Behaviour:
  - It validates with the existing regex.
  - A valid email opens the existing `WaitlistDetailsModal` (unchanged), which calls `joinWaitlist`.
  - On success the field becomes the green "You're on the list" pill.
  - Errors show under the field in `#FF8A8A`.
  - Props: `id`, `instruments`, `styles`, `note?`.
- **Finale** (home, and reusable): the band video seen through giant knocked-out type ("Tu turno" / "¡Dale!"), then a heading, a lede and a `WaitlistSignup` with `id="join"`. The knockout uses `mix-blend-mode:multiply` on a `--noche` layer, and the video is scaled 1.35 to hide its built-in letterbox bars.

### 1.4 Data helpers (pure, unit tested)
`lib/marketing/catalog.ts`:
- `buildCatalog({ courses, styles, countries, teachers, instruments })` returns:
  - `instruments[]`: `{ key, courses: CourseCard[], fundamentals: CourseCard|null, teachers: TeacherCard[] }`. `key` is the `courses.instrument` value.
  - `countries[]`: `{ slug, name, code, geo, styles: { slug, name, live, courseCount }[] }`
  - `counts`: `{ courses, maestros, instruments, styles, countries }`
- Rules:
  - Only `is_published` courses count.
  - `instrument === 'Various'` or `null` rows are never shown as courses, but they mark their style as existing.
  - A style is `live` when it has at least one published course.
  - `counts.instruments` is the number of rows in the `instruments` table (12).
  - `counts.styles` is the number of `musical_styles` rows that belong to a country.
  - `counts.countries` is the number of countries.
  - `counts.maestros` is the number of teachers.
- `teacherSeatKeys(instrumentText)` maps free-text `teachers.instrument` values to course instrument keys by keyword, case-insensitively:
  - `timbal`→Timbal, `conga`→Conga, `minor perc` or bare `percussion`→Minor Percussion, `drum`→Drums, `piano`/`acordeon`→Piano, `bass`/`bajo`→Bass, `tres`→Tres, `guitar`→Guitar, `violin`→Violin, `trumpet`→Trumpet, `sax`→Saxophone, `vocal`/`voice`/`singer`→Voice.
  - It returns unique keys in input order. Examples: "Percussion, Timbal" gives Minor Percussion and Timbal; "Guitar and Tres" gives Guitar and Tres; "Master Vocalist" gives Voice.
- `COUNTRY_META`: slug → `{ code, geo, color }`:
  - `cuba`: CU, "La Habana · 23.11°N 82.37°W", #FFA524
  - `puerto-rico`: PR, "San Juan · 18.47°N 66.11°W", #FF324D
  - `republica-dominicana`: DO, "Santo Domingo · 18.49°N 69.93°W", #A58BFF
  - `colombia`: CO, "Barranquilla · 10.97°N 74.80°W", #2FD1B5

`lib/marketing/stage-plot.ts` holds `SEATS`, the twelve seat positions, glyphs, channel labels and notes (EN+ES) keyed by instrument key, copied from `app.js SEATS`. The Trumpet/Saxophone/Voice seats are "soon" when the catalog has no published course for them.

`lib/marketing/pricing-calc.ts` provides `quote({ billing:'m'|'y', styles:number, maxStyles:number, prices })`, returning `{ amount, per, extraMonthly, savingsVsMonthly }`. Prices come from `getPricing()` (`base_monthly`, `base_annual`, `addon_monthly`, in cents), never hard-coded. `styles` is clamped to `[1, maxStyles]`. Yearly bills the base yearly and extras monthly.

`lib/marketing/data.ts` (server-only) provides `getMarketingCatalog(locale)`. It runs one query per table, applies `localizeRow`/`localizeTeachers`, and returns `buildCatalog(...)`. It is wrapped in React `cache()`.

## 2. Home (`/`)
Section order, from `body.html`:
1. **Hero.** Eyebrow with a live dot: "Waitlist open · {maestros} maestros · {instruments} instruments". Headline "Learn from / the masters / *of la música latina.*" (ES: "Aprende con / los maestros / *de la música latina.*"). Then the sub copy, `WaitlistSignup`, the note "Founding-member pricing from {base_monthly}/mo · one instrument + one style", and the piano-keys video on the right.
   - Piano keys:
     - Three `<video>` elements share `/videos/hero-video-final.mp4`, each positioned to show its slice of one composite frame (CSS vars `--vx/--vy/--vw/--vh` set from `offsetLeft/offsetTop`).
     - Videos are kept in sync with the first (resync when drift > 80ms) and paused off-screen.
     - `@property --press` drives the press animation, and the video counter-translates so the picture stays still.
     - Click plays a synthesized piano note via the shared audio module.
2. **Marquee.** One row of style names with country codes and a small clave-dot separator, 90s linear loop, paused on hover.
3. **Numbers.** Five cells from `counts`. They count up once on first view.
4. **Stage plot** ("Take your seat *in the orquesta.*"). SVG plot (viewBox 0 0 900 620, apron path `M30 40h840v480q-420 90-840 0z`) plus the detail panel.
   - The panel shows the instrument name, the course count (fundamentals + styles), course chips (Fundamentals chip in amber), the teachers with round grayscale photos, and a CTA "Browse {instrument} courses" → `/explore?instrument={key}`.
   - Soon seats show "Courses in production" plus "Get notified".
   - The default selection is the instrument with the most courses.
5. **Style atlas** ("Four countries. *Una clave.*"). Four columns: huge outlined country code, name, geo line, and a style list with "● Live" / "Coming soon". Live style names link to `/explore/{country}/{style}`.
6. **Groove** ("Everything starts *with the clave.*"). The step grid and transport: play/stop, Son 3-2 · 2-3 · Rumba, BPM −/+ (120–232, step 8, default 184), and the current chord in serif.
   - Audio is WebAudio synthesis, ported verbatim from `app.js` (`initAudio`, `SOUND`, the scheduler).
   - Patterns and chord logic go in `lib/marketing/groove/patterns.ts` (pure, tested: clave presets, `chordAt`, `antic`, velocity rules, cell toggling rules). Audio goes in `lib/marketing/groove/audio.ts`.
7. **PlaySense** ("Step into the session. *Miami, at dusk.*"). Full-width `StageClip`, four features in a row, and a "See how PlaySense works" link to `/playsense`.
8. **Maestros** ("Learn it from the ones *who play it.*"). A horizontal rail of every teacher with a photo (`next/image` from `teachers.image_url`; skip teachers without one). Photos are grayscale and colour on hover, cards tilt with the pointer, the rail has drag-to-scroll on mouse and prev/next buttons. Each card links to `/instructors/{id}`.
9. **Pricing** ("One instrument. *Everything it needs.*"). `PricingCalculator`, the "Every plan includes" card, and the All-access "Coming soon" card.
10. **Finale** with `#join`.

## 3. Explore, style and course pages
- **`/explore`**: `PageHead` ("Explore *the catalog.*", a live course count, and a search field).
  - A sticky toolbar with instrument chips (with counts) and country chips; countries with no live styles are disabled and marked "soon".
  - A responsive poster grid of every published course as a `Sleeve`, then the atlas.
  - Query params: `?instrument=` preselects the chip (keeps today's contract with the nav and dashboard). `?style=` is kept working by redirecting to the style page.
  - Filtering is client-side over the catalog, and each poster links to `/course-preview/{id}`.
- **`/explore/[countrySlug]`**: country hero (code, name, geo, the style list with live counts), then a poster grid of that country's courses.
- **`/explore/[countrySlug]/[styleSlug]`**: the "Son cubano" template. Hero with pills (country · clave · N courses). Then the story from `musical_styles.description` (localized), rendered as prose. If it's empty, show a short fallback line with no invented history. Then a static clave card (the clave preset for son-family styles, otherwise hidden), the style's course posters, and the teachers whose `specialties` mention the style name (case-insensitive, accent-insensitive). Finale at the end.
  - The prototype's Son Cubano history paragraphs may be used **only for `son-cubano`**, stored as i18n strings `marketing.site.style.story.son-cubano.{p1,p2,p3}`, because they were written and checked for that style.
- **`/course-preview/[courseId]`**: the prototype's course page.
  - Hero with the title split as "{style} *{instrument}.*" (fall back to the full title), description, pills (sections · lessons · PlaySense notation), the instructor card linking to `/instructors/{teacher_id}`, and a large `Sleeve`.
  - Body: "What you'll learn" (hide it when no data; do not invent bullets), then the curriculum accordion from `course_sections` → `classes` (numbered sections, lesson counts, "In production" for empty sections, "Free preview" for `is_free`), then "Practice every lesson in PlaySense" with `StageClip`.
  - A sticky enroll card with the plan price from `getPricing()`.

## 4. Instructors
- **`/instructors`**: `PageHead` ("Los *maestros.*"), family filter chips, and a portrait grid (same card as the rail) linking to `/instructors/{id}`. Then the philosophy quote and prose, then the finale.
  - Family is derived from `teacherSeatKeys`: Percussion (Timbal, Conga, Minor Percussion, Drums), Keys (Piano), Bass, Strings (Tres, Guitar, Violin), Horns (Trumpet, Saxophone), Voice.
- **`/instructors/[teacherId]`** (new): the Patricio profile template for every teacher.
  - A sticky portrait, then the name. A nickname in quotes is rendered serif italic gradient ("Patricio *“El Chino”* Díaz").
  - The instrument line, specialty chips, then the bio rendered from `teachers.bio`/`bio_es` TipTap JSON (reuse the plain-text or read-only renderer already in the repo) styled as prose.
  - Then the teacher's courses as `Sleeve` cards (via `courses.teacher_id`), then the finale.
  - Include no timeline data that isn't in the bio. The prototype's lineage list was hand-extracted from Patricio's bio for the mockup only.
  - `notFound()` for unknown ids.

## 5. PlaySense and Pricing
- **`/playsense`**: `PageHead` ("Play*Sense.*", the Biscayne Bay line).
  - Then the **live stage**: a client `LiveStage` that lazy-mounts `StageHighway` when scrolled into view (IntersectionObserver, `rootMargin 200px`). It drives it exactly like `app/playsense-preview/page.tsx` demo mode: `makeDemoExercise(instrument)`, its own rAF clock starting at −3.5s, auto-graded perfect events, a loop, `theme="studio"`, `fill`, `showHud={false}`, `hideCountdown`, and `quality="low"` under 768px.
  - Instrument switch: Congas · Timbales · Piano.
  - The HUD overlay is the same as `StageClip`'s but fed by real demo state.
  - If WebGL fails or under reduced motion, show `StageClip`.
  - Extract the demo clock and grader from `app/playsense-preview/page.tsx` into `lib/play-sense/demo-session.ts` so both pages share it; the preview page must behave exactly as before.
  - Then "How it works" (three steps), "Prefer the chart?" with the staff workspace (VexFlow bass tumbao, Side/Stacked/Music-only layouts; port `mountWS`/`buildStaff` as a client component, with the notation font loaded the way the app's notation already loads it), the six-feature grid, and the finale.
- **`/pricing`**: `PageHead` with the founding-pricing notice, `PricingCalculator` + "Every plan includes" + All-access, "How pricing works" (three steps), the plan comparison table, and a link to the FAQ.

## 6. About, FAQ, Contact, Blog, Legal
- **`/about`**: `PageHead` ("Keep the music *in good hands.*"), then the video plus manifesto and mission prose (from the existing `marketing.pages.about` copy, tightened), three values (Authentic / Structured / Rooted), numbers from `counts`, and the finale.
- **`/faq`**: `PageHead`, a sticky category nav, and `<details>` accordions. Rewrite the answers to match reality:
  - Prices come from `getPricing()`, interpolated.
  - Live instruments come from the catalog.
  - No free-trial claim and no "Cuatro"/"Tango"/"Bossa nova" claims.
  - Categories: Getting started, Subscription and billing, PlaySense.
  - Do not show the "Corrected" badges; those were for review.
- **`/contact`**: form (name, email, topic chips mapped to the API's whitelisted subjects, message) posting to the existing `/api/contact`, then the success state. Error states are visible (today they are swallowed). Side cards: email with a copy button (`support@latinmusicmastery.com`), response time, socials.
- **`/blog`** and **`/blog/[slug]`**:
  - Real `blog_posts`: a feature card for the newest post, a category filter, and a grid. Covers use `cover_image_url` via `next/image`, falling back to a `Sleeve` seeded by the slug.
  - The post page is restyled prose with related posts.
  - Empty state when there are no posts.
  - `NewsletterForm` stays client-only as today, restyled.
- **Legal pages**: keep the content and restyle the `LegalPage` component in the Noche look (`PageHead` + a prose column at about 68ch).

## 7. Assets
- `public/marketing/stage-miami.webm` (VP9) and `public/marketing/stage-miami.mp4` (H.264, for Safari) are 12-second recordings of the `studio` stage from `/playsense-preview`. Record them with `docs/superpowers/specs/assets/landing-redesign/record-stage.mjs`, adapted to request `video/mp4;codecs=avc1` when `MediaRecorder` supports it.
- `public/marketing/stage-miami-poster.jpg`.
- `<video>` lists both sources, MP4 first. `StageClip` loops through a 340ms dip to black, and its HUD numbers are derived from `currentTime` exactly as in `mountStage()`.
- Teacher photos come from Supabase storage through `next/image`. That host is already in `remotePatterns`.

## 8. Accessibility and motion
- Every interactive element is a real `button` or `a` with a visible `:focus-visible` ring (2px `--ambar`).
- Stage plot seats are keyboard operable (Enter/Space).
- `prefers-reduced-motion`: no grain, no marquee, no key press cycle, no reveal transforms, no count-up. Videos don't autoplay. The live stage falls back to the clip poster.
- Sound only ever starts from a click.
- The page never scrolls horizontally at 390px. Watch flex children with `nowrap` text; they need `min-width:0`.

## 9. Removal
When every page is ported, delete the dead marketing components:
- `VideoHero`, `StatsBar`, `AnimatedCounter`, `GradientText`, `PageHero`, `BreadcrumbNav`, `SectionWrapper`, `CTABanner`, `CourseCard`, `InstructorCard`, `InstructorBioModal`, `TestimonialCard`, `PricingCard`, `FloatingElements`, `MarketingHeader`, `MarketingFooter`
- everything in `app/(marketing)/sections/`
- `components/homepage/*` if unused

Also remove the unused `homepage.*` and `marketing.*` locale keys, and run `grep` to prove nothing imports them.

## 10. Testing
- Unit tests (vitest, node) for every pure helper: `catalog`, `teacherSeatKeys`, `pricing-calc`, `groove/patterns`, the demo-session grader and clock, and the nickname splitter for teacher names.
- **Locale parity test:** every key under `marketing.site` exists in both `en.json` and `es.json`, and no value is empty.
- `tsc --noEmit`, `next build`, and the full vitest suite (excluding worktrees) stay green.
- Browser check of every route at 1440 and 390 widths, headless Chrome through a dev server (see the `shot.mjs` recipe in memory), checking for console errors and horizontal overflow.
