# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved "Backdrop mix, card B" dashboard on the Studio Amber token set, with a hover-expanding rail whose icons never move, a route-aware header, real mobile navigation, and a shared page header adopted by the dashboard sub-pages.

**Architecture:** Tokens change in `app/globals.css` + `tailwind.config.js` and flow through the existing shadcn primitives. Pure, vitest-covered logic (streak, calendar, greeting, page title, recommendation reasons) lives in `lib/dashboard/`. The shell is three client components (rail, header title, mobile nav) around a tiny `SidebarStateProvider`; the home page keeps its server data-loading in `app/dashboard/page.tsx` and renders small presentational components from `components/dashboard/home/`.

**Tech Stack:** Next 16 (app router, RSC), React 19, TypeScript, Tailwind 3 with HSL tokens, Radix (dropdown, popover, sheet), Lucide, vitest (node).

**Spec:** `docs/superpowers/specs/2026-09-05-dashboard-redesign-design.md`

## Global Constraints

- No new npm dependencies. No database changes.
- Every user-facing string via `useTranslation()` (client) or `getServerTranslator()` (server); keys in BOTH `locales/en.json` and `locales/es.json`, inserted with targeted edits (never rewrite the files).
- Colors only via tokens: `primary`, `secondary`, `muted-foreground`, `card`, `sunken`, `raised`, `border`, `input`, `gold`, `terracotta`, `success`, `warning`, `danger`, `info`, `sidebar-*`. White text only on imagery.
- `lib/dashboard/**` must run under vitest `node` (no DOM, no React).
- Radii: `rounded-lg` for controls and nav items, `rounded-xl` for cards, `rounded-2xl` for the continue card, `rounded-full` for pills and avatars. No arbitrary radii.
- Icon sizes: `h-4 w-4` in controls/rows, `h-5 w-5` in rail and tab bar, `h-3.5 w-3.5` in chips.
- After every task: `npx tsc --noEmit`, `npm run lint`, `npx vitest run` all clean; then commit only that task's files with the trailer:
  ```
  Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_01RLheBjd3q5GW1mR6mFqFbS
  ```
- Work in the worktree `.claude/worktrees/dashboard-redesign` on branch `feat/dashboard-redesign`; dev server on port 3006.

---

## File map

| Path | Responsibility |
|---|---|
| `app/globals.css` | Studio Amber tokens (light + dark), radius, shadows, `--header-h`, semantic tokens, sidebar tokens as channels |
| `tailwind.config.js` | semantic colors, sidebar colors via `hsl(var())`, `shadow-card/lift/pop`, remove shim and `shadow-stripe*` |
| `components/theme-provider.tsx` | `'light' \| 'dark' \| 'system'`, resolved theme, storage |
| `app/layout.tsx` | no-flash inline theme script, `suppressHydrationWarning` |
| `components/settings/theme-preference.tsx` | System option |
| `components/ui/{button,card,badge,progress,avatar,input}.tsx` | primitives aligned to radius/shadow/badge variants |
| `lib/dashboard/streak.ts` | `computeStreaks(isoDates, today)` → `{ current, best }` |
| `lib/dashboard/practice-calendar.ts` | `buildPracticeCalendar(completedAt[], today, weeks)` |
| `lib/dashboard/greeting.ts` | `greetingKey(hour)` |
| `lib/dashboard/page-title.ts` | `resolvePageTitle(pathname)` → `{ titleKey, crumb }` |
| `lib/dashboard/recommendations.ts` | `reasonFor(course, ctx)`, `filterRecommended(list, filter, ctx)` |
| `lib/dashboard/__tests__/*.test.ts` | vitest for the five modules |
| `components/dashboard/sidebar-state.tsx` | `SidebarStateProvider`, `useSidebarState()` (pinned, mobileOpen) |
| `components/dashboard/dashboard-sidebar.tsx` | hover rail (rewrite) |
| `components/dashboard/nav-items.ts` | shared nav groups definition |
| `components/dashboard/mobile-nav.tsx` | Sheet nav + bottom tab bar |
| `components/dashboard/dashboard-layout-client.tsx` | gutter follows pinned state, container, tab-bar padding |
| `components/dashboard/dashboard-header.tsx` | contextual header (server) |
| `components/dashboard/header-title.tsx` | route-aware title (client) |
| `components/dashboard/header-search.tsx` | bordered trigger restyle |
| `components/dashboard/header-streak.tsx` / `header-streak-server.tsx` | link chip; server uses `lib/dashboard/streak.ts` |
| `components/dashboard/header-notifications.tsx` | dot indicator |
| `components/dashboard/account-menu.tsx` | translated account dropdown (replaces `components/user-nav.tsx` in the dashboard) |
| `components/dashboard/page-header.tsx`, `section-header.tsx` | shared headers |
| `components/dashboard/home/*.tsx` | greeting-row, continue-card, course-list, recommended-section, feedback-card, practice-calendar, master-class-card, tool-tiles, milestones-card, upgrade-card |
| `types/dashboard.ts` | `HomeData` and section prop types |
| `app/dashboard/page.tsx` | data loading, composes home sections |
| `app/dashboard/loading.tsx` | skeleton matching the layout |
| `locales/en.json`, `locales/es.json` | new keys |

---

### Task 1: Tokens, Tailwind config, theme provider

**Files:**
- Modify: `app/globals.css:11-156` (token blocks), `tailwind.config.js`
- Modify: `components/theme-provider.tsx`, `components/theme-toggle.tsx`, `components/settings/theme-preference.tsx`, `app/layout.tsx`

**Produces:** Tailwind classes `text-success|warning|danger|info`, `bg-sidebar`, `border-sidebar-border`, `bg-sidebar-accent`, `text-sidebar-foreground`, `shadow-card|lift|pop`, `bg-sunken`, `bg-raised`; CSS var `--header-h`; `useTheme()` returns `{ theme: 'light'|'dark'|'system', resolvedTheme: 'light'|'dark', setTheme, toggleTheme, mounted }`.

- [ ] **Step 1: Replace the `:root` and `.dark` token blocks in `app/globals.css`** with the Studio Amber values from the spec table (keep the `--chart-*`, `--playsense-studio-*` and `--spacing-*` lines). Add to both blocks:
  ```css
  --success: 145 55% 36%;  --warning: 38 92% 40%;  --danger: 0 70% 46%;  --info: 210 80% 44%;   /* light */
  --success: 145 50% 50%;  --warning: 40 90% 60%;  --danger: 0 75% 64%;  --info: 210 85% 66%;   /* dark */
  ```
  Set `--radius: 0.625rem;` in `:root`. Add `--header-h: 3.5rem;` to `:root`. Replace the standalone sidebar blocks (lines 136–156) with channel values inside `:root`/`.dark` (see spec). Add shadows:
  ```css
  :root {
    --shadow-card: 0 1px 2px hsl(var(--shadow-warm) / .05), 0 6px 16px -10px hsl(var(--shadow-warm) / .12);
    --shadow-lift: 0 2px 4px hsl(var(--shadow-warm) / .06), 0 14px 32px -14px hsl(var(--shadow-warm) / .20);
    --shadow-pop:  0 8px 20px -10px hsl(var(--shadow-warm) / .18), 0 28px 64px -20px hsl(var(--shadow-warm) / .30);
  }
  .dark {
    --shadow-card: 0 1px 2px hsl(0 0% 0% / .25), 0 6px 16px -10px hsl(0 0% 0% / .45);
    --shadow-lift: 0 2px 4px hsl(0 0% 0% / .3), 0 14px 32px -14px hsl(0 0% 0% / .6);
    --shadow-pop:  0 8px 20px -10px hsl(0 0% 0% / .5), 0 28px 64px -20px hsl(0 0% 0% / .7);
  }
  ```
  Remove the duplicated second `@layer base { * {...} body {...} }` block (lines 158–164) and fold `outline-ring/50` into the first.
- [ ] **Step 2: `tailwind.config.js`**: delete `cssVarColor`; `sidebar` scale becomes `hsl(var(--sidebar…))` with `DEFAULT, foreground, primary{DEFAULT,foreground}, accent{DEFAULT,foreground}, border, ring`; add `success/warning/danger/info: "hsl(var(--x))"`; `boxShadow` becomes `{ card: "var(--shadow-card)", lift: "var(--shadow-lift)", pop: "var(--shadow-pop)", warm: <keep> }` (remove `stripe*`). Keep `borderRadius` mapping.
- [ ] **Step 3: Theme provider**: `type Theme = 'light' | 'dark' | 'system'`; state `theme` (stored) and `resolvedTheme`; on mount read `localStorage.theme` (default `'dark'` when missing, matching current behavior); `resolvedTheme = theme === 'system' ? (matchMedia dark ? 'dark' : 'light') : theme`; listen to `matchMedia` changes when `system`; apply `.dark` from `resolvedTheme`; `toggleTheme` cycles light → dark → system → light. Export `useTheme()`.
- [ ] **Step 4: No-flash script** in `app/layout.tsx` inside `<head>`-less body start: `<script dangerouslySetInnerHTML={{ __html: "try{var t=localStorage.getItem('theme');var d=t==='dark'||((!t||t==='system')&&matchMedia('(prefers-color-scheme: dark)').matches);if(t===null){d=true}document.documentElement.classList.toggle('dark',d)}catch(e){}" }} />` as the first child of `<body>`, and `suppressHydrationWarning` on `<html>`. (Missing key → dark, matching the provider default.)
- [ ] **Step 5: `theme-toggle.tsx`**: icon `Sun` for light, `Moon` for dark, `Monitor` for system; `aria-label` from `common.switchToLightMode/DarkMode` plus new `common.useSystemTheme`; accept `className` and an `iconClassName` prop (rail passes `h-5 w-5`). `theme-preference.tsx`: add a System `SelectItem` (`Monitor` icon) and translate the three labels with `t('common.theme.{dark,light,system}')`.
- [ ] **Step 6: Locale keys** (both files): `common.useSystemTheme`, `common.theme.{label,dark,light,system}`.
- [ ] **Step 7: Verify**: `npx tsc --noEmit && npm run lint && npx vitest run`. Open `http://localhost:3006/dashboard` in dark and light: amber buttons show dark text; borders visible in dark; no theme flash on reload in light.
- [ ] **Step 8: Commit** `feat(tokens): studio amber palette, semantic colors, shadows, system theme`.

### Task 2: Primitives

**Files:** `components/ui/button.tsx`, `card.tsx`, `badge.tsx`, `progress.tsx`, `avatar.tsx`, `input.tsx`

- [ ] **Step 1: Button**: base `rounded-lg`; sizes `default: h-10 px-5`, `sm: h-9 px-4 rounded-lg`, `lg: h-11 px-6 rounded-lg`, `icon: size-10 rounded-lg`, `icon-sm: size-9 rounded-lg`, `icon-lg: size-11 rounded-lg`; `destructive` uses `text-destructive-foreground` instead of `text-white`; `terracotta` variant `text-primary-foreground`; add `ondark: "bg-white/12 text-white border border-white/20 backdrop-blur-md hover:bg-white/20"`. Keep `default` `bg-primary text-primary-foreground hover:bg-primary/90` and add `shadow-[0_6px_18px_-8px_hsl(var(--primary)/.55)]` to `default`.
- [ ] **Step 2: Card**: `rounded-xl border border-border bg-card text-card-foreground shadow-card` and drop the `gap-6 py-6` defaults? **No** — other pages rely on them; keep `flex flex-col gap-6 py-6` and only add `shadow-card`.
- [ ] **Step 3: Badge**: keep `rounded-full`; variants: `default` (primary tint: `border-transparent bg-primary/14 text-primary`), `solid` (`bg-primary text-primary-foreground`), `secondary`, `destructive`, `outline`, `success` (`bg-success/14 text-success`), `warning` (`bg-warning/16 text-warning`), `danger` (`bg-danger/14 text-danger`), `info`, `gold` (`bg-gold/16 text-gold`), `onImage` (`bg-black/60 text-white border-white/15 backdrop-blur-sm`). Check existing `variant="default"` consumers (grep) — if any rely on the solid look, switch them to `solid`.
- [ ] **Step 4: Progress**: root `bg-foreground/10 h-1.5 rounded-full`; indicator `bg-primary`; accept `indicatorClassName` prop for gold/success fills.
- [ ] **Step 5: Avatar**: `AvatarFallback` default `bg-primary/18 text-primary font-semibold`.
- [ ] **Step 6: Input**: `h-9 rounded-lg border-input bg-card` (was `rounded-md`).
- [ ] **Step 7: Verify** tsc/lint/tests; skim `/dashboard/settings` and `/dashboard/subscribe` on 3006 for regressions. **Commit** `feat(ui): align primitives to radius, shadow and semantic badge variants`.

### Task 3: Pure dashboard logic with tests

**Files:** `lib/dashboard/{streak,practice-calendar,greeting,page-title,recommendations}.ts`, `lib/dashboard/__tests__/*.test.ts`

**Produces:**
```ts
// streak.ts
export function toLocalDateKey(iso: string, tz?: string): string  // 'YYYY-MM-DD' in tz (default: process/UTC as given)
export function computeStreaks(dateKeys: string[], todayKey: string): { current: number; best: number }
// practice-calendar.ts
export interface CalendarCell { key: string; count: number; level: 0|1|2|3; isToday: boolean; inFuture: boolean }
export function buildPracticeCalendar(dateKeys: string[], todayKey: string, weeks = 5): { cells: CalendarCell[]; weekDoneCount: number }
export function levelFor(count: number): 0|1|2|3   // 0→0, 1→1, 2→2, ≥3→3
// greeting.ts
export function greetingKey(hour: number): 'morning' | 'afternoon' | 'evening'   // 5–11, 12–17, else
// page-title.ts
export function resolvePageTitle(pathname: string): { titleKey: string; crumb: 'date' | 'home' }
// recommendations.ts
export interface RecCourse { id: string; instrument: string | null; teacherId: string | null; teacherName: string | null; createdAt: string | null; difficulty: string | null }
export interface RecContext { instruments: string[]; teacherIds: string[]; teacherNames: string[]; enrolledTitlesByTeacherId: Record<string,string>; now: string }
export type RecReason = { kind: 'instrument'; instrument: string } | { kind: 'teacher'; teacher: string; course: string } | { kind: 'new' } | { kind: 'popular' }
export function reasonFor(course: RecCourse, ctx: RecContext): RecReason
export type RecFilter = 'all' | 'instrument' | 'teachers' | 'new'
export function filterRecommended<T extends RecCourse>(list: T[], filter: RecFilter, ctx: RecContext): T[]
export function isNew(createdAt: string | null, now: string, days = 30): boolean
```

- [ ] **Step 1: Write tests first** in `lib/dashboard/__tests__/streak.test.ts` (current streak counts back from today or yesterday; broken streak → 0; best streak is the longest consecutive run; duplicates collapse), `practice-calendar.test.ts` (35 cells ending on the Saturday of today's week; counts and levels; today flagged; future cells flagged; `weekDoneCount` counts current week only), `greeting.test.ts`, `page-title.test.ts` (`/dashboard` → home+date; `/dashboard/courses` → `dashboard.nav.browseCourses`; `/dashboard/course/abc` → `dashboard.nav.myCourses`; unknown → home), `recommendations.test.ts` (priority instrument > teacher > new > popular; filters).
- [ ] **Step 2: Run** `npx vitest run lib/dashboard` → all FAIL (modules missing).
- [ ] **Step 3: Implement** the five modules. Week starts Sunday. `buildPracticeCalendar` computes the Saturday ending today's week, walks back `weeks*7 - 1` days, and maps counts from a `Map<dateKey, count>`.
- [ ] **Step 4: Run** tests → PASS. `npx tsc --noEmit`, lint.
- [ ] **Step 5: Commit** `feat(dashboard): pure streak, calendar, greeting, title and recommendation logic`.

### Task 4: Sidebar rail, sidebar state, mobile nav, layout shell

**Files:**
- Create: `components/dashboard/sidebar-state.tsx`, `components/dashboard/nav-items.ts`, `components/dashboard/mobile-nav.tsx`
- Rewrite: `components/dashboard/dashboard-sidebar.tsx`, `components/dashboard/dashboard-layout-client.tsx`, `components/dashboard/mobile-sidebar-trigger.tsx`
- Modify: `app/dashboard/layout.tsx`, `app/globals.css` (rail transition helper), `locales/*.json`
- Delete: `components/ui/sidebar.tsx`

**Produces:** `useSidebarState()` → `{ pinned, setPinned, mobileOpen, setMobileOpen }`; `NAV_GROUPS: { key: 'learn'|'discover'|'connect'|'tools'; items: NavItemDef[] }[]`, `MANAGE_ITEMS(isTeacher, isAdmin)`.

- [ ] **Step 1: `sidebar-state.tsx`**: client context; `pinned` initial from prop `defaultPinned` (layout reads cookie `sidebar_state === 'true'`); `setPinned` writes `document.cookie = 'sidebar_state=' + v + '; path=/; max-age=31536000'`; `mobileOpen` plain state.
- [ ] **Step 2: `nav-items.ts`**: move the item definitions out of the sidebar; add `badgeKey?: 'feedback'` on Teacher Feedback.
- [ ] **Step 3: `dashboard-sidebar.tsx`** structure (client):
  ```tsx
  <nav aria-label={t('dashboard.nav.label')} data-pinned={pinned}
       className="group/rail fixed inset-y-0 left-0 z-50 hidden md:flex w-16 data-[pinned=true]:w-[248px] hover:w-[248px] focus-within:w-[248px]
                  flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-[width,box-shadow] duration-200
                  hover:shadow-pop data-[pinned=true]:shadow-none overflow-hidden px-3 py-3">
    {/* brand row: fixed h-10 */}
    <div className="relative flex h-10 items-center">
      <Link href="/dashboard" className="flex h-10 w-10 shrink-0 items-center justify-center" aria-label={t('dashboard.nav.home')}>
        <Image src="/logo-solo-color.svg" alt="" width={32} height={24} className="h-6 w-8 object-contain" />
      </Link>
      <Image src="/sidebar-logo.svg" alt="Latin Music Mastery" width={196} height={22}
             className="ml-1 h-[22px] w-auto opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-data-[pinned=true]/rail:opacity-100" />
      <button onClick={() => setPinned(!pinned)} aria-label={pinned ? t('dashboard.nav.unpin') : t('dashboard.nav.pin')}
              className="absolute right-0 top-1 grid h-8 w-8 place-items-center rounded-lg text-muted-foreground opacity-0 hover:bg-sidebar-accent hover:text-sidebar-foreground group-hover/rail:opacity-100 group-data-[pinned=true]/rail:opacity-100">
        {pinned ? <PinOff className="h-4 w-4" /> : <Pin className="h-4 w-4" />}
      </button>
    </div>
    {/* groups: scroll region */}
    <div className="mt-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden [scrollbar-width:none]">
      {groups.map(g => (
        <div key={g.key}>
          {/* label row: fixed h-6, hairline when collapsed, text when expanded */}
          <div className="relative flex h-6 items-center px-2">
            <span className="absolute left-3 right-3 h-px bg-sidebar-border transition-opacity group-hover/rail:opacity-0 group-data-[pinned=true]/rail:opacity-0" />
            <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground opacity-0 transition-opacity whitespace-nowrap group-hover/rail:opacity-100 group-data-[pinned=true]/rail:opacity-100">{t(`dashboard.nav.groups.${g.key}`)}</span>
          </div>
          {g.items.map(item => <RailItem key={item.href} item={item} active={isActive(pathname, item.href)} badge={badges[item.badgeKey]} />)}
        </div>
      ))}
    </div>
    {/* footer rows: fixed h-10 each */}
    <div className="mt-2 flex flex-col gap-1">
      <LanguageToggle variant="rail" />   {/* new variant: h-10 row, icon left at same x, label fades */}
      <ThemeToggle variant="rail" />
      <Link href="/dashboard/settings" className="flex h-10 items-center rounded-lg px-1 hover:bg-sidebar-accent"> <Avatar 32px/> <span className="ml-3 min-w-0 opacity-0 …">name / plan</span></Link>
    </div>
  </nav>
  ```
  `RailItem`: `<Link aria-current={active ? 'page' : undefined} className="relative flex h-10 items-center rounded-lg pl-[11px] pr-2 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground data-[active=true]:bg-primary/12 data-[active=true]:text-primary">` with the icon `h-5 w-5 shrink-0`, label `ml-3 truncate text-sm font-medium opacity-0 group-hover/rail:opacity-100 group-data-[pinned=true]/rail:opacity-100`, the active indicator `absolute -left-3 top-2.5 bottom-2.5 w-[3px] rounded-r bg-primary`, badge pill `ml-auto opacity-0 group-hover…` and collapsed dot `absolute left-[26px] top-2 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-sidebar group-hover/rail:opacity-0 …`. Item width is the container width (`w-full`), so collapsed = 40px (64 − 24 padding) and the icon center stays at 12 + 11 + 10 = 33px in both states.
- [ ] **Step 4: `LanguageToggle`** gets a `variant="rail"` (row layout as above; keep `icon` and `labeled`). `ThemeToggle` gets `variant="rail"` (row: icon + label "Theme: Dark/Light/System").
- [ ] **Step 5: `mobile-nav.tsx`**: `MobileNavSheet` (uses `Sheet side="left"`, `open={mobileOpen}`, renders brand + groups expanded + footer rows) and `MobileTabBar` (`fixed inset-x-0 bottom-0 z-40 md:hidden grid grid-cols-4 h-16 border-t border-border bg-background/92 backdrop-blur`, items Home/Courses/Practice/Profile with `h-5 w-5` icons and 10.5px labels, active `text-primary`). `mobile-sidebar-trigger.tsx` calls `setMobileOpen(true)`.
- [ ] **Step 6: `dashboard-layout-client.tsx`**: reads `pinned`; wrapper `<div className="min-h-screen">` with `<main className="min-h-screen pt-[var(--header-h)] md:pl-16 data-[pinned=true]:md:pl-[248px] transition-[padding] duration-200"><div className="mx-auto w-full max-w-[1280px] px-4 pb-24 pt-6 sm:px-6 md:pb-8 lg:px-10 lg:py-8">{children}</div></main>`; the header gets the same left offset via a class on a `data-pinned` root (`[&_header]:md:left-16 data-[pinned=true]:[&_header]:md:left-[248px]`). Page scrolling returns to the window (remove `h-screen overflow-hidden`); the header is `fixed`.
- [ ] **Step 7: `app/dashboard/layout.tsx`**: read `cookies().get('sidebar_state')`, wrap in `<SidebarStateProvider defaultPinned>`; pass `isAdmin/isTeacher/userEmail/userName/userAvatar (profile.avatar_url)/planLabel` to the sidebar; render `MobileNavSheet` and `MobileTabBar`. Delete `components/ui/sidebar.tsx`.
- [ ] **Step 8: Locale keys**: `dashboard.nav.label`, `groups.*`, `pin`, `unpin`, `openMenu`, `tabs.*`, `common.theme.*` if not done.
- [ ] **Step 9: Verify** in the browser on 3006: hover the rail, run in console `[...document.querySelectorAll('nav a svg')].map(s=>s.getBoundingClientRect().x)` before and during hover — identical arrays. Pin persists across reload. 390px: hamburger opens the sheet, tab bar visible. tsc/lint/tests. **Commit** `feat(shell): hover-expanding rail with real logo, pinned state, mobile sheet and tab bar`.

### Task 5: Contextual header

**Files:**
- Create: `components/dashboard/header-title.tsx`, `components/dashboard/account-menu.tsx`
- Modify: `components/dashboard/dashboard-header.tsx`, `dashboard-header-wrapper.tsx`, `header-search.tsx`, `header-streak.tsx`, `header-streak-server.tsx`, `header-notifications.tsx`
- Delete: `components/dashboard/header-continue.tsx`, `header-continue-server.tsx`, `header-continue-server 2.tsx`, `dashboard-welcome-text.tsx`
- Modify: `locales/*.json`

- [ ] **Step 1: `header-title.tsx`** (client): `usePathname()` → `resolvePageTitle`; crumb: `'date'` → `new Intl.DateTimeFormat(locale === 'es' ? 'es' : 'en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date())` (client-only after mount, `suppressHydrationWarning`), `'home'` → `t('dashboard.nav.home')` with a `ChevronRight h-3 w-3`. Title `font-heading text-[15px] font-bold tracking-tight leading-tight`; crumb `text-xs text-muted-foreground`.
- [ ] **Step 2: `header-streak-server.tsx`**: query `class_item_progress.completed_at where user_id and completed`, map to date keys, `computeStreaks`. `header-streak.tsx`: `<Link href="/dashboard/progress" className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold …">` with `bg-primary/14 text-primary` when > 0 else `bg-secondary text-muted-foreground`; tooltip kept.
- [ ] **Step 3: `header-search.tsx`** trigger: `h-9 w-9 md:w-56 rounded-lg border border-input bg-card px-3 text-muted-foreground hover:border-foreground/25`; kbd shows `⌘K` on Mac, `Ctrl K` otherwise (detect `navigator.platform` after mount).
- [ ] **Step 4: `header-notifications.tsx`**: trigger `variant="ghost" size="icon-sm"` with `Bell h-4 w-4` and a dot `absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background` when unread; popover rows unchanged.
- [ ] **Step 5: `account-menu.tsx`** (client): props `{ name, email, avatarUrl, planStatus: 'free'|'active', isAdmin, isTeacher }`; trigger avatar 36px; content `w-64`: header block (avatar, name, email), items with icons: Profile and settings → `/dashboard/settings`, Plan (right-aligned `Free`/`Active`) → `/dashboard/subscription`, My progress → `/dashboard/progress`, separator, Help → `/dashboard/help`, Teacher Portal (if), Admin Panel (if), separator, Sign out (`variant="destructive"`). All via `t('dashboard.header.account.*')`.
- [ ] **Step 6: `dashboard-header.tsx`**: fetch profile (`full_name, avatar_url, is_admin`), teacher row, active subscription; render `<MobileSidebarTrigger/> <HeaderTitle/> <div className="ml-auto flex items-center gap-2"><HeaderSearch/><HeaderStreak/><HeaderNotifications/><AccountMenu/></div>`. Wrapper: `fixed top-0 right-0 left-0 md:left-16 z-40 h-[var(--header-h)] border-b border-border bg-background/80 backdrop-blur-xl` (left offset also driven by pinned via the layout root class from Task 4). Delete the four files.
- [ ] **Step 7: Locale keys** `dashboard.header.account.*`.
- [ ] **Step 8: Verify** title changes per route; streak matches the home page; tsc/lint/tests. **Commit** `feat(header): route-aware title, bordered search, streak link, account menu`.

### Task 6: Home page data layer and types

**Files:** `types/dashboard.ts`, `app/dashboard/page.tsx`

**Produces:** `HomeData` consumed by Task 7 components:
```ts
export interface HomeCourseSummary { id: string; slug: string; title: string; thumbnailUrl: string | null; styleName: string | null; teacherName: string | null; totalClasses: number; doneClasses: number; currentClassIndex: number | null; currentClassTitle: string | null; pct: number }
export interface ContinueCard { course: HomeCourseSummary; classId: string; classTitle: string; classIndex: number; totalClasses: number; classMinutes: number | null; classPct: number; teacherName: string | null; teacherImage: string | null; nextClassTitle: string | null; resumeHref: string; courseHref: string; segments: ('done'|'current'|'todo')[] }
export interface RecommendedCourse extends RecCourse { slug: string; title: string; thumbnailUrl: string | null; styleName: string | null; lessonCount: number | null; reason: RecReason; isNew: boolean; href: string }
export interface FeedbackSummary { kind: 'completed' | 'pending' | 'none'; teacherName?: string; teacherImage?: string | null; message?: string; hasVideo?: boolean; createdAt?: string; status?: string }
export interface MasterClassSummary { id: string; slug: string; title: string; teacherName: string | null; thumbnailUrl: string | null; styleName: string | null }
export interface HomeData { firstName: string | null; streak: number; bestStreak: number; weekDone: number; weekGoal: number; continueCard: ContinueCard | null; courses: HomeCourseSummary[]; recommended: RecommendedCourse[]; recContext: RecContext; feedback: FeedbackSummary; calendar: CalendarCell[]; masterClass: MasterClassSummary | null; milestones: MilestoneItem[]; hasSubscription: boolean }
```

- [ ] **Step 1: Rewrite `app/dashboard/page.tsx` data section** to produce `HomeData`: Batch 1 adds `teacher:teachers(id,name,image_url)` and `musical_style:musical_styles(name,name_es)` and `instrument` to the enrollment course select; adds queries `class_item_progress.select('completed_at').eq('user_id').eq('completed', true)` (all dates) and `feedback_requests.select('status,message,response_message,response_video_url,created_at,teachers(name,image_url)').order('created_at',{ascending:false}).limit(1)`, `courses` master class `.eq('is_master_class',true).eq('is_published',true).order('created_at',{ascending:false}).limit(1)`. Recommendations: `courses.select('id,slug,title,title_es,thumbnail_url,difficulty,instrument,created_at,teacher_id,teacher_name,teacher:teachers(id,name),musical_style:musical_styles(name,name_es),course_sections(classes(id))').eq('is_published',true).eq('is_master_class',false).not('id','in',...).limit(8)`. Class order: sections by `order_index`, classes by `order_index`; a class is "done" when all its items are completed; the current class is the one holding the most recently updated incomplete item (fall back to the first not-done class of the most recently accessed course). `classMinutes = Math.round(sum(video_duration_seconds)/60) || null` (add `video_duration_seconds` to the item select). Streaks from `computeStreaks(keys, todayKey)`; calendar from `buildPracticeCalendar`. Time zone: use the server's local date keys via `toLocalDateKey` with `Intl` default (document the limitation in a comment).
- [ ] **Step 2: Temporarily render** `<pre>{JSON.stringify(homeData, null, 1)}</pre>` to eyeball the shape on 3006, then remove.
- [ ] **Step 3: tsc/lint/tests. Commit** `feat(dashboard): home data model for the backdrop layout`.

### Task 7: Home page sections

**Files:** Create `components/dashboard/section-header.tsx`, `components/dashboard/home/{greeting-row,continue-card,course-list,recommended-section,feedback-card,practice-calendar,master-class-card,tool-tiles,milestones-card,upgrade-card}.tsx`; modify `app/dashboard/page.tsx` (render), `app/dashboard/loading.tsx`; delete `components/dashboard/{welcome-summary,quick-actions,week-strip,daily-practice-tip,featured-teacher-spotlight,recent-activity,recommended-featured,my-courses-section,continue-learning-hero,start-learning-card,course-mode-activator,learning-milestones,subscription-cta,animated-section}.tsx` (`animated-section` only if no other consumer remains — grep first); `locales/*.json`.

- [ ] **Step 1: `section-header.tsx`**: `<div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-2"><h2 className="font-heading text-xl font-bold tracking-tight">{title}</h2>{count && <span className="text-sm text-muted-foreground">{count}</span>}{children}{href && <Link className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-primary">{linkLabel}<ChevronRight className="h-3.5 w-3.5"/></Link>}</div>`.
- [ ] **Step 2: `continue-card.tsx`** (server-safe): outer `relative isolate grid overflow-hidden rounded-2xl shadow-lift text-white md:grid-cols-[minmax(280px,36%)_1fr] bg-[hsl(20_10%_5%)] animate-fade-in-up`; blurred layer `absolute -inset-16 -z-10 bg-cover bg-center blur-[40px] saturate-[1.2] brightness-50` with `style={{ backgroundImage }}`; scrim `absolute inset-0 -z-10 bg-gradient-to-r from-black/15 to-black/55`; cover column with the image (`next/image fill sizes="(min-width:1024px) 36vw, 100vw"`) or the gradient from `lib/course-covers`, a bottom scrim and the number block (`font-heading text-[96px] font-extrabold leading-none tracking-tighter` with a small uppercase "Lesson" label); body with eyebrow, `h2` title (`font-heading text-3xl font-bold tracking-tight`), meta row, `Segments` (`flex gap-1` of `h-1.5 flex-1 rounded-full` spans: done `bg-primary`, current `ring-[1.5px] ring-inset ring-primary`, todo `bg-white/20`), button row (`Button` default lg + `Button variant="ondark" lg`) and the up-next line. Empty variant: `Card` with compass `ichip`, title, body, Browse button.
- [ ] **Step 3: `course-list.tsx`**: rows as spec; uses `Progress` with `className="h-1"`.
- [ ] **Step 4: `recommended-section.tsx`** (client, for chips): state `filter`; `filterRecommended`; featured = first, rest = next 3; `Badge` variants by difficulty via a small `difficultyVariant()` helper in the same file; "why" box `flex gap-2 rounded-lg border border-primary/20 bg-primary/8 p-3 text-sm`.
- [ ] **Step 5: `feedback-card.tsx`**, **`practice-calendar.tsx`** (ring as inline SVG, grid `grid-cols-7 gap-1.5` of `aspect-square rounded-[4px]` cells with `bg-primary/35|60|90` and `ring-2 ring-primary/60` for today, `bg-foreground/6` for empty), **`master-class-card.tsx`**, **`tool-tiles.tsx`**, **`milestones-card.tsx`** (ported from `learning-milestones` compact), **`upgrade-card.tsx`** (ported from `subscription-cta`), **`greeting-row.tsx`** (client; `greetingKey(new Date().getHours())` after mount).
- [ ] **Step 6: Compose in `page.tsx`**: `<div className="space-y-6 lg:space-y-8"><GreetingRow/><ContinueCard/><div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-8"><div className="space-y-8 min-w-0"><CourseList/><RecommendedSection/><FeedbackCard/></div><aside className="space-y-6 lg:sticky lg:top-[calc(var(--header-h)+2rem)] lg:self-start"><PracticeCalendar/><MasterClassCard/><ToolTiles/><MilestonesCard/><UpgradeCard/></aside></div></div>`.
- [ ] **Step 7: `loading.tsx`**: skeleton blocks in the same grid (greeting line, 340px-tall rounded-2xl block, three 64px rows, two rail cards).
- [ ] **Step 8: Delete** the listed dead components (grep each import first); add locale keys from the spec's i18n list (both files).
- [ ] **Step 9: Verify** on 3006 in dark and light, 1440 and 390px; check the empty state by temporarily forcing `continueCard = null` (then revert). tsc/lint/tests. **Commit** `feat(dashboard): backdrop home page with course list, recommendations, feedback and practice calendar`.

### Task 8: PageHeader and sub-pages

**Files:** Create `components/dashboard/page-header.tsx`; modify the view files listed in the spec; delete `app/dashboard/play-sense/play-sense-header.tsx`.

- [ ] **Step 1: `page-header.tsx`**: `PageHeader({ title, description, crumb, actions, className })` per spec.
- [ ] **Step 2 (8a):** my-courses, teachers, master-class, achievements: replace each hand-rolled `h1`/subtitle block with `<PageHeader title={t(...)} description={t(...)} actions={…existing buttons…} />`.
- [ ] **Step 3 (8b):** feedback, community, help, progress, settings.
- [ ] **Step 4 (8c):** subscription (both branches), subscribe, tuner, play-sense (delete `play-sense-header.tsx`), courses (`courses-view.tsx`: replace the `.eyebrow` + `.bc-title` + subtitle block; keep the rest of `browse-courses.css`).
- [ ] **Step 5: Verify** each page on 3006 renders, tsc/lint/tests. One commit per sub-step: `refactor(pages): adopt PageHeader on …`.

### Task 9: Sync the prototype and wrap up

- [ ] **Step 1:** In the Design Lab artifact source (`scratchpad/src/stage.css`, `dash.js`, `lab.js`), make the rail's label rows fixed-height so icons don't shift, and use the real logo (embed `logo-solo-color.svg` and `sidebar-logo.svg` as data URIs) in place of the "LM" mark; rebuild and republish to the same URL.
- [ ] **Step 2:** Final `npx tsc --noEmit && npm run lint && npx vitest run`; browser pass in both modes; `git log --oneline main..HEAD`.
- [ ] **Step 3:** Report: branch, commits, what to review on 3006, known limitations (server-local date keys, no course-page header offset change).
