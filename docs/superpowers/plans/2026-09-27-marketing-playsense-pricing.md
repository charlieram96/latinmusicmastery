# Marketing: /playsense + /pricing — Plan

Spec: `docs/superpowers/specs/2026-09-27-marketing-site-redesign-design.md` §5. Prototype: `PAGES['playsense-page']`, `PAGES['pricing-page']`, `mountWS`/`buildStaff`/`tickWS` in `app.js`.

## Task 1 — `lib/play-sense/demo-session.ts` (TDD)
Pure demo clock + auto-grader lifted out of `app/playsense-preview/page.tsx`:
- `DEMO_LEAD_IN = -3.5`, `DEMO_TAIL = 0.35`, `frameDelta(now, last)` (0 on first frame, capped at 0.1 s).
- `createDemoSession()` → `{ elapsed, matched:Set, results[] }`; `resetDemoSession(s)`.
- `stepDemoSession(s, dt, { expected, duration, demo })` → `{ added, looped, ended }`. Demo grades every due event `perfect`; live mode marks events more than 150 ms past as `miss`. At `duration + DEMO_TAIL` demo mode loops (resets), live mode reports `ended`.
- `comboOf(results)`, `demoMeasure(elapsed, bpm)` (1..4), `demoBeat(elapsed, bpm)` (0..3).
- Tests: `lib/play-sense/__tests__/demo-session.test.ts`.

## Task 2 — preview page uses it
Replace the refs/loop in `app/playsense-preview/page.tsx` with a `session` ref; behaviour unchanged (same tone calls, same reset, same loop/ended semantics). Screenshot `/playsense-preview`.

## Task 3 — `StageHighway` status callback
Add optional `onStatus?: (s: 'ready' | 'error') => void` (no behaviour change for existing callers) so the marketing stage can swap poster → live and fall back on errors.

## Task 4 — `/playsense`
- `app/(marketing)/playsense/page.tsx` (server): PageHead, `LiveStage`, how-it-works, `StaffWorkspace`, six-feature grid, `<Finale/>`. Delete `playsense-content.tsx`.
- `components/marketing/playsense/LiveStage.tsx` (client): WebGL + reduced-motion probe → `StageClip` fallback; IntersectionObserver (`rootMargin 200px`) → `next/dynamic` StageHighway (`ssr:false`); poster until `ready`; rAF clock via demo-session, paused off-screen/hidden; instrument switch (conga/timbale/piano); HTML HUD with `.sh-*` classes fed by real state.
- `components/marketing/playsense/StaffWorkspace.tsx` (client): port of `mountWS`/`buildStaff`/`tickWS` staff view with `import('vexflow')` (bundles Bravura, same as the app) — chords, counts, bar tint, played dimming, simulated judgments, Side/Stacked/Music-only with View Transitions.
- `app/(marketing)/styles/playsense.css`: prototype workspace rules missing from `marketing.css` (`.app-bar`, `.staff-host`, `.ph-line`, `.judge`, …) + live-stage bits, all under `.mkt`.

## Task 5 — `/pricing`
`app/(marketing)/pricing/page.tsx` (server): PageHead + `.glass.notice`, `PricingCalculator` (catalog instruments, `instrumentLabel`, `getPricing()`), includes + All-access cards, three steps and comparison table with every price from `formatCents` and the saving from `yearlySavingPercent`, FAQ link, `<Finale/>`. Delete `pricing-content.tsx`.

## Task 6 — locales
Keys under `marketing.site.playsense.*` and `marketing.site.pricing.*` (EN + ES), inserted above the sentinels; `site-locale-keys.test.ts` passes.

## Verify
tsc, full vitest, eslint on touched files, screenshots 1440×900 + 390×844 of `/playsense`, `/pricing`, `/playsense-preview`, overflow check, code review.
