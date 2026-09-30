# Marketing Explore / Style / Course Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/explore`, `/explore/[countrySlug]`, `/explore/[countrySlug]/[styleSlug]` and `/course-preview/[courseId]` in the Noche look, ported from the prototype templates `PAGES.explore`, `PAGES['son-cubano']` and `PAGES.course`.

**Architecture:** Server pages read `getMarketingCatalog(locale)` (plus direct Supabase queries for style descriptions, curriculum and teacher details) and pass plain data to small client components (filterable poster browser, curriculum accordion). Pure logic (filtering, style→teacher matching, clave presets, title accent split) lives in `lib/marketing/*` with vitest tests.

**Tech Stack:** Next.js 16 app router, React server components, Supabase, vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-marketing-site-redesign-design.md` §3 (plus the shared brief).

## Global Constraints
- Every visible string via i18n, only under `marketing.site.explore|style|course`, inserted above the `"_"` sentinel, EN + ES; `site-locale-keys.test.ts` stays green.
- No fabricated content: no "What you'll learn" bullets, counts from data only; Son Cubano story only for `son-cubano`.
- Styles: prototype classes from `marketing.css` (do not edit it); extras in `app/(marketing)/styles/explore.css`, scoped under `.mkt`.
- `params`/`searchParams` are Promises. Unknown country/style/course or unpublished course → `notFound()`.
- No horizontal scroll at 390px; real links/buttons; reduced motion honoured.

## Review Focus
- `?instrument=` with a value not in the catalog (or wrong case) → falls back to "All", no crash. Test in Task 1 (`initialInstrument`).
- `?style=` slug that doesn't exist → stays on `/explore` (no redirect loop, no 404). Handled in Task 4 page.
- Accents/punctuation in specialties ("Timba.", "danzón", "Cha cha cha" vs "Cha-Cha-Cha") → still match. Test in Task 2.
- A matcher that is too loose ("Salsa" specialty matching "Salsa Colombiana" is intended; "Son" must not match "Songo"). Test in Task 2.
- Course with sections but zero classes, or no sections at all → "In production" rows / curriculum hidden, no NaN counts. Task 6.

---

### Task 1: Explore filter logic
**Files:** Create `lib/marketing/explore-filter.ts`, test `lib/marketing/__tests__/explore-filter.test.ts`.
**Produces:**
- `type ExploreFilter = { instrument: string; country: string; q: string }` (`'all'` = no filter)
- `filterCourses(courses: CatalogCourse[], f: ExploreFilter, label: (instrumentKey: string) => string): CatalogCourse[]` — instrument equality, `countrySlug` equality, query matched accent/case-insensitively against style name + instrument label + raw instrument + title.
- `initialInstrument(param: string | undefined, keys: string[]): string` — exact key, else case-insensitive match, else `'all'`.
- Tests: each filter alone and combined, accent-insensitive query ("danzon" finds "Danzón"), unknown instrument → `'all'`, "minor percussion" → "Minor Percussion".

### Task 2: Style helpers
**Files:** Create `lib/marketing/style-teachers.ts`, `lib/marketing/style-clave.ts`, `lib/marketing/title-accent.ts`; tests for each.
**Produces:**
- `normalizeName(s): string` — NFD, strip diacritics, lowercase, drop non-alphanumerics.
- `styleNameVariants(name): string[]` — normalized name, plus the name without a trailing country adjective (cubano/a, puertorriqueño/a, dominicano/a, colombiano/a).
- `teachersForStyle<T extends { specialties: string[] }>(teachers: T[], styleName: string): T[]` — a teacher matches when any normalized specialty equals any variant.
- `findTeacherByName<T extends { name: string }>(teachers: T[], name: string | null): T | null`.
- `claveForStyle(slug): { key: 'son32' | 'rumba32'; hits: number[] } | null` — son family (son-cubano, salsa-cubana, mambo, timba, guaracha, guajira) → son 3-2 `[0,3,6,10,12]`; rumba → rumba 3-2 `[0,3,7,10,12]`; else null. Also exports `BONGO_HITS`, `BASS_HITS`.
- `splitTitleAccent(text): { lead: string; accent: string }` — multi-word: last word is the accent; one word: all accent.
- Tests: "Son Cubano" matches "Son" and "Son Cubano" but "Songo" doesn't match "Son"; "Timba." matches "Timba"; "Cha cha cha" matches "Cha-Cha-Cha"; "danzón" matches "Danzón"; clave mapping; accent split.

### Task 3: Shared explore components
**Files:** `components/marketing/explore/Poster.tsx` (Sleeve + `.pmeta` link), `ClaveCard.tsx` (static `.clave-card/.seq-row/.cells` grid), `Curriculum.tsx` (client accordion, `.curric/.sec-item`), `ExploreBrowser.tsx` (client: PageHead with search, sticky toolbar with instrument/country chips, count, poster grid; syncs `?instrument=` with `history.replaceState`), `app/(marketing)/styles/explore.css`.

### Task 4: `/explore` page
Rewrite `app/(marketing)/explore/page.tsx`: `?style=` → `redirect('/explore/{country}/{style}')` when the catalog has it; `ExploreBrowser` with labels; atlas section (`StyleAtlas`) with "in production" lede built from countries without live styles (`Intl.ListFormat`); `Finale`. Metadata from `marketing.site.explore.meta.*`.

### Task 5: Country + style pages
Rewrite `[countrySlug]/page.tsx` (PageHead "Styles of *Cuba.*", code/geo/style list with counts, poster grid, Finale) and `[countrySlug]/[styleSlug]/page.tsx` (pills, story, ClaveCard, posters, matched maestros via `MaestroCard`, Finale). Son Cubano story strings `marketing.site.style.story.son-cubano.{p1,p2,p3}`.

### Task 6: Course preview
Rewrite `course-preview/[courseId]/page.tsx`: published check, style/country join, sections→classes localized, teacher by `teacher_id` or `findTeacherByName(teacher_name)`, hero (title split, description, pills, `.inst-card`, big Sleeve), Curriculum, StageClip, sticky enroll card from `getPricing()`, Finale.

### Task 7: Verify
tsc, full vitest, eslint on touched files, headless screenshots at 1440×900 and 390×844 for each route, code review, fix, commit.
