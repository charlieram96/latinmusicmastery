# Dashboard Redesign — Design

**Date:** 2026-09-05
**Routes:** `/dashboard` (home), the dashboard shell used by every `/dashboard/*` route, and the page headers of the dashboard sub-pages.
**Status:** Approved in conversation (palette, header, sidebar, and dashboard concept were each picked by the user from the prototype).
**Prototype of record:** https://claude.ai/code/artifact/f6c5ea7e-188d-4777-b84e-af2371a508c2 — section "Dashboards", concept **"Backdrop mix, card B"**; sidebar and header sections; component gallery; tokens section.

## Goal

Make the logged-in app read as one polished system: a single token set (Studio Amber), a sidebar that stays collapsed and expands on hover without moving its icons, a header that says where you are, and a dashboard home built around the current lesson, the practice calendar, the course list, and a recommendation section that explains its picks. Then carry the same page-header pattern to the other dashboard pages.

## Why

The audit in the prototype's appendix found: no labels or groups in the nav and a dead mobile hamburger; a header showing a marketing greeting with six controls in four radii; two card systems on one screen; six radii and thirteen one-off type sizes; `amber-*` classes standing in for `--primary`; contrast failures; sections that return `null` when empty; a loading skeleton that does not match the page; a theme provider that flashes dark for light users; unused sidebar tokens stored as full colors behind a color-mix shim.

## Locked decisions

### Palette: Studio Amber

Values are bare HSL channels in the format `app/globals.css` already uses. Dark borders keep the channel-with-alpha form.

| Token | Light | Dark |
|---|---|---|
| `--background` | `30 25% 97.5%` | `20 10% 5%` |
| `--foreground` | `20 12% 12%` | `30 10% 93%` |
| `--card` / `--card-foreground` | `0 0% 100%` / `20 12% 12%` | `20 8% 8.5%` / `30 10% 93%` |
| `--popover` / `--popover-foreground` | `0 0% 100%` / `20 12% 12%` | `20 7% 11%` / `30 10% 93%` |
| `--surface-sunken` | `30 20% 95%` | `20 10% 3.5%` |
| `--surface-raised` | `0 0% 100%` | `20 7% 12%` |
| `--primary` / `--primary-foreground` | `28 85% 50%` / `24 40% 9%` | `30 85% 55%` / `24 40% 8%` |
| `--secondary` / `--secondary-foreground` | `30 15% 93%` / `20 12% 12%` | `20 7% 12%` / `30 10% 93%` |
| `--muted` / `--muted-foreground` | `30 15% 93%` / `25 8% 40%` | `20 7% 12%` / `25 6% 63%` |
| `--accent` / `--accent-foreground` | `30 30% 94%` / `20 12% 12%` | `20 8% 14%` / `30 10% 93%` |
| `--destructive` / `--destructive-foreground` | `0 70% 46%` / `0 0% 98%` | `0 75% 64%` / `0 0% 98%` |
| `--border` / `--input` / `--ring` | `30 12% 86%` / `30 12% 84%` / `28 85% 50%` | `0 0% 100% / 0.10` / `0 0% 100% / 0.12` / `30 85% 55%` |
| `--gold-highlight` / `--terracotta` | `38 65% 44%` / `14 55% 46%` | `38 60% 58%` / `14 55% 55%` |
| `--success` / `--warning` / `--danger` / `--info` | `145 55% 36%` / `38 92% 40%` / `0 70% 46%` / `210 80% 44%` | `145 50% 50%` / `40 90% 60%` / `0 75% 64%` / `210 85% 66%` |
| `--sidebar` / `--sidebar-foreground` | `30 22% 96%` / `20 12% 12%` | `20 10% 4%` / `30 10% 93%` |
| `--sidebar-border` / `--sidebar-accent` / `--sidebar-accent-foreground` | `30 12% 88%` / `30 20% 91%` / `20 12% 12%` | `0 0% 100% / 0.08` / `0 0% 100% / 0.06` / `30 10% 93%` |
| `--sidebar-primary` / `--sidebar-primary-foreground` / `--sidebar-ring` | `28 85% 50%` / `24 40% 9%` / `28 85% 50%` | `30 85% 55%` / `24 40% 8%` / `30 85% 55%` |
| `--shadow-warm` | `24 30% 20%` | `0 0% 0%` |
| `--warm-surface` (kept for pages not yet migrated) | `30 20% 96%` | `16 14% 8%` |

Consequences accepted: `--primary-foreground` becomes dark, so every `bg-primary text-primary-foreground` button in the app (marketing included) switches from white text to espresso text on amber. That is the intended look and clears 6:1 in both modes. Sidebar tokens become channels; the `cssVarColor` color-mix shim in `tailwind.config.js` is deleted and the `sidebar` color scale uses `hsl(var(--x))` like every other color. The `.dark` `--sidebar: #0E0E0E` hex is gone.

### Radius, elevation, type

- `--radius: 0.625rem`. Tailwind's `rounded-sm/md/lg` follow it (6 / 8 / 10 px). Cards use `rounded-xl` (12px), the backdrop card `rounded-2xl` (16px). No arbitrary radii (`rounded-[18px]`, `rounded-[10px]`) in dashboard code.
- Shadows: `--shadow-card`, `--shadow-lift`, `--shadow-pop` defined in `globals.css` from `--shadow-warm`, with stronger alphas under `.dark`. Exposed as Tailwind `shadow-card`, `shadow-lift`, `shadow-pop`. `shadow-stripe*` entries are removed from the config (no consumers).
- One card recipe on the dashboard: `bg-card border border-border rounded-xl shadow-card`. `.warm-surface` stays defined for pages that still use it but is not used by the shell or the home page.
- Type: Montserrat for page titles, section titles, and course/lesson titles (`font-heading font-bold tracking-tight`); Inter for everything else. Page title `text-2xl md:text-3xl`, section title `text-xl`, card title `text-base font-semibold`, body `text-sm`, meta `text-xs`, one overline per screen (`text-[11px] uppercase tracking-[0.12em] font-semibold text-primary`, the backdrop eyebrow).
- Semantic colors are Tailwind colors `success`, `warning`, `danger`, `info`. Difficulty maps beginner → success, intermediate → warning, advanced → danger. No `amber-*`, `orange-*`, `emerald-*`, `green-*`, `red-*` classes in shell or home code.

### Theme provider

- Adds `system` to `'light' | 'dark'`; resolves with `matchMedia('(prefers-color-scheme: dark)')` and re-resolves on change.
- An inline script in `app/layout.tsx` (before hydration) reads `localStorage.theme` and sets `.dark` on `<html>` so light-mode users never see a dark flash. `<html>` gets `suppressHydrationWarning`.
- The settings page select offers Dark, Light, System.

### Sidebar (hover rail)

- Fixed left, `z-50`, `w-16` (64px) collapsed. On hover it becomes `w-[248px]` and overlays the page (the page keeps its 64px gutter; nothing reflows). Width transitions 180ms. A pin (top-right of the brand row, visible when expanded) keeps it open; pinned state persists in the existing `sidebar_state` cookie via a small `SidebarStateProvider`, and when pinned the layout gutter becomes 248px.
- **No icon movement between states.** Every row has the same height in both states: brand row `h-10`; each group has a `h-6` label row that shows a hairline when collapsed and the group name when expanded; items are `h-10`, `w-10` collapsed and `w-full` expanded with the same left padding, so each icon's center stays at x = 32px; footer rows are `h-10`. Labels fade in (`opacity`) inside `overflow-hidden whitespace-nowrap` containers; nothing changes height.
- Brand row: the real mark, `public/logo-solo-color.svg`, in a 32px box (`object-contain`, the asset is 714×534). When expanded, `public/sidebar-logo.svg` (the horizontal lockup) is shown at 22px height to the right of the mark; collapsed hides it without affecting layout.
- Groups and items (labels from `dashboard.nav.*`): Learn (Home, My Courses), Discover (Browse Courses, Teachers, Master Class, Achievements), Connect (Teacher Feedback, Community), Tools (Tuner, Play Sense), Manage (Teacher Portal if teacher, Admin Panel if admin). Subscription leaves the rail; it lives in the account menu and the account row.
- Item states: rest `text-sidebar-foreground/70`; hover `bg-sidebar-accent text-sidebar-foreground`; active `bg-primary/12 text-primary` plus a 3px indicator flush with the rail's left edge. Badge slot: a count pill when expanded, a dot on the icon when collapsed (used for unread teacher feedback).
- Footer (bottom-anchored, `h-10` rows): language toggle, theme toggle (cycles light → dark → system), account row (avatar 32px; expanded adds name and plan; links to `/dashboard/settings`).
- No tooltips: hovering the rail reveals labels. Items keep `aria-label`.
- Below `md`: rail hidden. The header hamburger opens a `Sheet` (from `components/ui/sheet.tsx`) with the same groups in expanded form. A bottom tab bar (`Home`, `Courses` → `/dashboard/courses`, `Practice` → `/dashboard/play-sense`, `Profile` → `/dashboard/settings`) is fixed at the bottom on phones; `main` gets bottom padding for it.
- `components/ui/sidebar.tsx` (unused shadcn sidebar) is deleted; the `Cmd/Ctrl+B` handler goes with it.

### Header (contextual)

- Fixed top, `h-14`, left offset follows the gutter (64 or 248px), `bg-background/80 backdrop-blur-xl border-b border-border`.
- Left: hamburger on phones; then a title block derived from the pathname: for `/dashboard` the crumb is today's date (`Intl.DateTimeFormat`, locale-aware, weekday + month + day) and the title is `dashboard.nav.home`; for other routes the crumb is `dashboard.nav.home` and the title is that page's title key. Mapping lives in `lib/dashboard/page-title.ts`.
- Right, in order, all 36px tall and `rounded-lg`: search field (`w-56`, visible border `border-input bg-card`, `⌘K`/`Ctrl K` hint by platform), streak chip (a link to `/dashboard/progress`; flame + count; muted when 0), notifications (dot instead of a count badge), account menu (36px avatar; header with name and email; Profile and settings, Plan with current status, My progress; Help; Teacher Portal / Admin Panel when applicable; Sign out as destructive). All labels translated.
- Removed from the header: the marketing greeting, the amber Continue button, the theme toggle (now in the rail footer).
- Streak in the header and on the home page come from the same `lib/dashboard/streak.ts` over `class_item_progress.completed_at`. The header's old `user_progress_legacy` source is dropped.

### Layout shell

- `main` content is wrapped in `mx-auto w-full max-w-[1280px] px-4 py-6 sm:px-6 lg:px-10 lg:py-8`; `pb-24 md:pb-8` for the tab bar.
- Header height is `--header-h: 3.5rem` in `globals.css`; the shell uses it for `top`/`padding-top`. Course and lesson pages that hard-code 56px are out of scope here but can adopt the variable later.
- The two-column dashboard grid is `lg:grid-cols-[minmax(0,1fr)_340px] gap-6`; the right rail is `lg:sticky lg:top-[calc(var(--header-h)+2rem)] self-start`.

### Dashboard home ("Backdrop mix, card B")

Order and data, top to bottom in the main column, then the rail. Every section handles its empty state; nothing returns `null` silently except where noted.

1. **Greeting row.** `h1`: "Good morning/afternoon/evening, {first name}" (hour bucket computed on the client; text carries `suppressHydrationWarning`). Right: streak chip and "{n} of {goal} lessons" chip. Weekly goal is a constant, 6 lessons.
2. **Continue card (card B).** Grid: cover (36%) + body. Cover: course `thumbnail_url` or the warm gradient from `lib/course-covers.ts`, a bottom scrim, and a large lesson number ("Lesson 05" using the index of the current class within the course). Body sits on a blurred, darkened copy of the same cover (`::before` with `filter: blur(40px) saturate(1.2) brightness(.5)`) and is always dark in both modes. Eyebrow: "{course title}, lesson {n} of {total}". Title: the current class title. Meta: teacher avatar (image or initials) and name, class duration ("{m} min" from summed `video_duration_seconds` when > 0), "{pct}% watched" (class items completed / items). Segmented progress: one segment per class in the course; done, current (outlined), upcoming. Buttons: Resume (primary, to the class route the current hero already uses) and Course details (translucent white-on-dark). Right of the buttons: "Up next: {next class title}" when a next class exists.
   Empty state (no in-progress item): compass icon, "Pick your first course", one line of body copy, Browse courses button. The first lesson of every course is free is not asserted.
3. **My courses list.** Section header with count ("{n} in progress") and View all → `/dashboard/my-courses`. Rows: 72×45 thumbnail or gradient, course title in the heading face, "{teacher}, lesson {n} of {total}" or "not started" or "completed", 160px progress bar with percentage, chevron; whole row links to the course. Hidden when there are no enrollments (the continue card's empty state covers that case).
4. **Recommended for you.** Section header with "Picked from what you play", filter chips (All, For {instrument} when the user has an enrolled instrument, Your teachers, New), Browse all → `/dashboard/courses`. Fetches up to 8 published, non-master-class courses the user is not enrolled in. Featured card (left, wider): cover 16:8 with difficulty badge and "New" (gold) when `created_at` is within 30 days, title, teacher, a highlighted "why" line, and a Preview button to the course. Compact list (right): up to 3 more with thumbnail, title, teacher, difficulty badge, "{n} lessons" when known. Reasons, in priority order: same instrument as an enrolled course ("Because you play {instrument}"), same teacher ("More from {teacher}, who teaches your {course}"), new ("New this month"), otherwise "Popular with new learners". Filters are client-side over the fetched list. Empty list: the section is omitted.
5. **Teacher feedback.** Section header with "{n} new" when a completed response exists and All reviews → `/dashboard/feedback`. One card: latest `feedback_requests` row by `created_at`. Completed (`status === 'completed'` and `response_message`): teacher avatar and "{teacher} reviewed your clip", the response as a two-line quote, time ago, buttons Watch review (when `response_video_url`) or Read review, and Send a new clip. Pending: "Your clip is with {teacher}" with the status badge and the request date. No requests: an invitation card with Send a clip. No invented scores.
6. **Rail: Practice calendar.** Header row with a 44px ring showing "{done}/{goal}" for the week and "Weekly goal: {k} to go" (or "Goal reached"), plus "{streak}-day streak, best {best}". A 5-week grid (Sun–Sat, ending with the current week) from `class_item_progress.completed_at` counts per local day: 0 → empty cell, 1 → 35% primary, 2 → 60%, 3+ → 90%; today has a ring. One line of guidance below: "Practice today to keep the streak" when today is empty and the streak is > 0, otherwise "Even ten minutes counts."
7. **Rail: Master class.** The newest published course with `is_master_class`: label, thumbnail strip, title, teacher name, Watch → course. Omitted when none exists. No schedule or "live" claims.
8. **Rail: Tools.** Two tiles: Tuner → `/dashboard/tuner`, Play Sense → `/dashboard/play-sense`, each with icon, name, one-line description.
9. **Rail: Next milestones.** Existing `LearningMilestones` data, restyled to the card recipe: three rows with icon chip, title, "{current} / {requirement}", thin gold bar.
10. **Rail: Unlock every course.** Existing subscription CTA restyled (tinted card, one primary button), hidden for active subscribers.

Removed from the home page: WelcomeSummary, QuickActions, WeekStrip, DailyPracticeTip, FeaturedTeacherSpotlight, RecentActivity, the old hero, RecommendedFeatured, MyCoursesSection, and the framer-motion mount cascade. The backdrop card gets one 300ms CSS fade-in; `prefers-reduced-motion` is honored by the existing global clamp. Dead files are deleted: `start-learning-card.tsx`, `course-mode-activator.tsx`, `header-continue*.tsx` (including the stray `header-continue-server 2.tsx`), `dashboard-welcome-text.tsx`, `components/ui/sidebar.tsx`. `app/dashboard/loading.tsx` mirrors the new layout (greeting line, backdrop block, list rows, rail cards).

Data queries stay in `app/dashboard/page.tsx`, organized as three batches like today: profile, subscription, enrollments with sections/classes/items, achievements, completed progress rows for the last 35 days, all completion dates for the streak; then progress for enrolled items; then recommendations, master class, latest feedback request. The unused `allCourses` query is dropped.

### Page headers on other pages

- `components/dashboard/page-header.tsx`: `PageHeader({ title, description?, crumb?, actions? })` renders the crumb (small, muted), the `h1` (`font-heading font-bold tracking-tight text-2xl md:text-3xl text-balance`), the description (`text-muted-foreground`, max 60ch), and an actions slot right-aligned; bottom margin `mb-8`.
- `components/dashboard/section-header.tsx`: `SectionHeader({ title, count?, href?, linkLabel?, children? })` renders `h2` (`font-heading text-xl font-bold tracking-tight`), an optional count, an optional right link, and an optional slot for chips.
- Adopt `PageHeader` on: my-courses, courses (replacing the `.bc-title` block), teachers, master-class, achievements, feedback, community, help, progress, settings, subscription, tuner, play-sense (replacing `play-sense-header.tsx`). Adopt `SectionHeader` on the home page.

## Hard constraints

- No new npm dependencies. No database changes.
- Every user-facing string goes through `useTranslation()` (client) or `getServerTranslator()` (server) with keys in BOTH `locales/en.json` and `locales/es.json`. Edits to the locale files are targeted insertions, never whole-file rewrites.
- Colors only through tokens: `primary`, `secondary`, `muted-foreground`, `card`, `sunken`, `raised`, `border`, `input`, `gold`, `terracotta`, `success`, `warning`, `danger`, `info`, `sidebar-*`. Pure white text is allowed only on imagery (cover scrims, the backdrop body, the continue card).
- Pure logic lives in `lib/dashboard/*.ts` and runs under vitest's `node` environment (no DOM imports).
- Icons from `lucide-react`; icon sizes `h-4 w-4` in controls and rows, `h-5 w-5` in the rail and tab bar, `h-3.5 w-3.5` inside chips.
- Work happens in the `feat/dashboard-redesign` worktree; commit after each task with the session trailer.

## Accessibility

- Every icon-only control has an `aria-label`. The rail is a `nav` with `aria-label`. Active nav items carry `aria-current="page"`.
- Focus rings use `ring` on all controls; the rail's hover expansion also happens on `:focus-within` so keyboard users see labels.
- Text contrast: foreground/background ≥ 15:1, muted on card ≥ 5:1, primary-foreground on primary ≥ 6:1 (verified in the prototype's contrast readouts). White text on covers sits on a scrim of at least 55% black.

## i18n

New keys (both locales): `dashboard.nav.groups.{learn,discover,connect,tools,manage}`, `dashboard.nav.{pin,unpin,openMenu}`, `dashboard.nav.tabs.{home,courses,practice,profile}`, `dashboard.header.account.{profile,plan,planFree,planActive,progress,help,signOut}`, `dashboard.pages.home.greeting.{morning,afternoon,evening}`, `dashboard.pages.home.continue.{eyebrow,lessonOfTotal,minutes,watched,lessonsDone,toGo,upNext,courseDetails,resume,emptyTitle,emptyBody,browse}`, `dashboard.pages.home.courses.{title,inProgress,lessonOfTotal,notStarted,completed,viewAll}`, `dashboard.pages.home.recommended.{title,subtitle,browseAll,preview,filters.{all,forInstrument,yourTeachers,new},why.{instrument,teacher,new,popular},lessons}`, `dashboard.pages.home.feedback.{title,newCount,allReviews,reviewed,pendingWith,watch,read,sendNew,inviteTitle,inviteBody,sendClip}`, `dashboard.pages.home.calendar.{title,goalToGo,goalReached,streakBest,keepStreak,tenMinutes}`, `dashboard.pages.home.masterClass.{label,watch}`, `dashboard.pages.home.tools.{title,tuner,tunerBody,playSense,playSenseBody}`, `dashboard.pages.home.weeklyGoalChip`. Existing keys (`dashboard.pages.home.nextMilestones`, `subscriptionCta.*`, `dashboard.nav.*`, `dashboard.header.search.*`, `dashboard.header.notifications.*`, `dashboard.header.streak.*`) are reused.

## Testing

- vitest (node): `lib/dashboard/streak.ts` (current and best streak from ISO dates, today/yesterday grace), `lib/dashboard/practice-calendar.ts` (35-cell grid, counts per local day, intensity buckets, today flag), `lib/dashboard/greeting.ts` (hour → key), `lib/dashboard/page-title.ts` (pathname → title key and crumb kind), `lib/dashboard/recommendations.ts` (reason priority and filters).
- `npx tsc --noEmit` and `npm run lint` clean after every task.
- Browser check on the worktree server (port 3006) in dark and light: rail collapsed/hover/pinned with no icon movement (compare icon `getBoundingClientRect().x` before and after hover), header title per route, home page with data and with the empty state, 390px width with the sheet and tab bar.

## Out of scope

- Course, lesson, module and admin pages beyond adopting the tokens automatically. Their hard-coded 56px header offsets stay.
- The `.st-*`, `.bc-*` and `.sv-*` CSS systems (only the browse-courses page title block is replaced).
- Bookmarks/saves, a recorded "last tuner note", practice-minute tracking, live master class scheduling, and feedback scores: none exist in the data model and none are shown.
- Marketing pages, except that they inherit the new tokens.
