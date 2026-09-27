# Marketing Home (`/`) Implementation Plan

> **For agentic workers:** executed natively by the home page agent (superpowers:executing-plans). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the old home page with the "Noche" home from the prototype: hero with piano-key video, marquee, numbers, stage plot, atlas, groove sequencer, PlaySense clip, maestros rail, pricing, finale.

**Architecture:** `app/(marketing)/page.tsx` is a server component that loads `getMarketingCatalog(locale)`, `getPricing()` and the translator, then renders small section components from `components/marketing/home/`. Interactive pieces (keys, numbers count-up, stage plot panel, groove, rail) are `'use client'`. Pure logic (seats, patterns) lives in `lib/marketing/` with vitest tests; WebAudio lives in `lib/marketing/groove/audio.ts` (client only).

**Tech Stack:** Next.js 16 app router, React 19, TypeScript, vitest (node env), WebAudio, plain CSS scoped under `.mkt`.

**Spec:** `docs/superpowers/specs/2026-09-27-marketing-site-redesign-design.md` §2; prototype `docs/superpowers/specs/assets/landing-redesign/{body.html,app.js,pages.css}`; shared brief in the lead's scratchpad.

## Global Constraints
- Every visible string through i18n, keys only under `marketing.site.home` (inserted above the `"_"` sentinel, no reformatting), both `en.json` and `es.json`; Spanish from `body.html` `data-es`.
- Do not edit `app/(marketing)/marketing.css` or the layout; extra rules go to `app/(marketing)/styles/home.css`, scoped under `.mkt`.
- No fabricated content; every count from `catalog.counts`; prices from `getPricing()` cents.
- Sound only from a click; `prefers-reduced-motion` honoured (no count-up, no key cycle, no autoplay); no horizontal scroll at 390px.
- Stage plot never pulses; 12 seats; sax at (215,450) inside apron `M30 40h840v480q-420 90-840 0z`, viewBox `0 0 900 620`.
- Groove BPM 120–232 step 8, default 184.

## Review Focus
- Catalog without a "Patricio" teacher → glass chip hidden, no broken image (page.tsx: `patricio && <HeroKeys chip>`).
- Instrument with no teachers or zero courses (soon seat) → panel shows "Courses in production", "Get notified" → `#join`, "Instructor to be announced" (tested via `seatState` in stage-plot tests).
- Teacher without a photo → excluded from rail, round placeholder in panel.
- Editing a clave cell after choosing a preset → preset buttons all un-pressed (tested: `detectClave` returns null).
- Bass toggle on the last step (15) wraps to step 0's chord root (tested: `toggleCell('bajo', 15)`).

---

### Task 1: Stage plot data
**Files:** Create `lib/marketing/stage-plot.ts`, `lib/marketing/__tests__/stage-plot.test.ts`
**Produces:** `SEATS: Seat[]` (`{ key, x, y, glyph, ch, name:{en,es}, note:{en,es} }`), `SEAT_GLYPHS: Record<Glyph,string>` (SVG inner markup), `PAD = { w:124, h:100 }`, `seatByKey(key)`, `defaultSeatKey(instruments)` (most courses, ties by INSTRUMENT_ORDER).
- [ ] Test: every `INSTRUMENT_ORDER` key has exactly one seat; no two pad rects overlap; all pads inside the 900×620 viewBox; sax at (215,450); `defaultSeatKey` picks the max `total`.
- [ ] Implement from `app.js SEATS` (positions as in prototype's final build).
- [ ] Commit.

### Task 2: Groove patterns
**Files:** Create `lib/marketing/groove/patterns.ts`, `lib/marketing/groove/__tests__/patterns.test.ts`
**Produces:** `INST_IDS`, `CLAVES`, `CHORDS`, `ROOT`, `VOICE`, `chordAt(s)`, `antic(s)`, `type Pattern`, `initialPattern(clave?)`, `withClave(p, key)`, `vel(p, id, s)`, `toggleCell(p, id, s): Pattern` (immutable), `detectClave(p)`.
- [ ] Tests: presets son32 `[0,3,6,10,12]`, son23 `[2,4,8,11,14]`, rumba32 `[0,3,7,10,12]`; `chordAt` C F G F per beat, negative wrap; `antic(3)==='F'`, `antic(15)==='C'`; velocity conga h .32 s .78 o/O 1, piano h .9 l .7, bajo 1, campana value; toggle conga 0→o, h→o, o→s, s→0; bajo toggles to `ROOT[chordAt(s+1)]` and off; piano 0→h; campana downbeat 1 else .55; clave on/off and `detectClave`.
- [ ] Implement, pass, commit.

### Task 3: Groove audio + GrooveSection UI
**Files:** Create `lib/marketing/groove/audio.ts`, `components/marketing/home/Groove.tsx`
**Produces (audio.ts):** `ensureAudio()`, `playPianoNote(midi)`, `createGroove({ getPattern, isMuted, onStep })` → `{ start(bpm), stop(), setBpm(n), pump(), triggerNow(id, s) }`. Ported verbatim from `initAudio`, `SOUND`, `schedule`, key click synth.
- [ ] UI: play/stop, clave seg, BPM −/+, rows with mute buttons (`aria-pressed`), cells (labels), counts row, chord output; `now` only while playing.
- [ ] tsc + eslint, commit.

### Task 4: Hero + marquee + numbers
**Files:** Create `components/marketing/home/{Hero.tsx,HeroKeys.tsx,Marquee.tsx,Numbers.tsx}`
- [ ] HeroKeys (client): 3 `.key` + 2 `.bkey` buttons, `.kv > video` slices, ResizeObserver `--vx/--vy/--vw/--vh`, 80ms resync, IntersectionObserver play/pause (not under reduced motion), tilt ≥1100px, click → `playPianoNote` (60–64) + `.hit`; Patricio `.glass.g1` chip only.
- [ ] Marquee (server): styles from catalog countries, codes, `.cdots` 1,0,1,1,0,1, duplicated row.
- [ ] Numbers (client): five cells, count-up once at threshold .4, 90ms stagger, 1300ms cubic, skip under reduced motion.
- [ ] Commit.

### Task 5: Stage plot section
**Files:** Create `components/marketing/home/StagePlot.tsx`
- [ ] SVG from `SEATS` (`role=button`, `tabIndex=0`, Enter/Space), selected `.sel`, no pulse. Panel: name, note, count (fundamentals + styles), chips (Fundamentals amber), teachers with round grayscale `next/image`, CTA `/explore?instrument={key}` or soon state.
- [ ] Commit.

### Task 6: PlaySense, maestros rail, pricing, page assembly, locales, cleanup
**Files:** Create `components/marketing/home/{PlaySenseSection.tsx,MaestroRail.tsx,PricingSection.tsx}`, `app/(marketing)/styles/home.css`; modify `app/(marketing)/page.tsx`, `locales/en.json`, `locales/es.json`; delete `app/(marketing)/sections/*`, `components/marketing/VideoHero.tsx`, `components/marketing/StatsBar.tsx` (+ `AnimatedCounter.tsx` if unused).
- [ ] Rail: drag-to-scroll (mouse only, suppress click after drag), prev/next by 2 cards, snap.
- [ ] Pricing: `PricingCalculator` with catalog instruments, default most courses; includes card; All-access.
- [ ] page.tsx assembles sections in spec order, keeps `generateMetadata`.
- [ ] Locale parity test passes; commit.

### Task 7: Verification + review
- [ ] `npx tsc --noEmit -p .`, full vitest, eslint on changed files.
- [ ] Dev server on 3021; screenshots at 1440×900 and 390×844; scrollWidth check; fix.
- [ ] superpowers:requesting-code-review on branch diff vs `feat/marketing-redesign`; fix; commit.
