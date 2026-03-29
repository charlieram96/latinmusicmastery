# PlaySense Rhythm Highway — Design Spec

## Context

PlaySense is a real-time music practice system with scoring, combo tracking, and visual feedback. The current UI uses React + Framer Motion with SVG-based instrument visualizations (conga, fretboard, piano, violin). While functional, the gameplay phase lacks the visceral, immersive feel of a rhythm game. This spec describes a PixiJS-powered 3D highway renderer that replaces the current visualization during active gameplay to deliver a Guitar Hero-style experience.

## Design Decisions

- **Visual style:** Guitar Hero-style 3D highway with notes scrolling toward a hit zone
- **Rendering engine:** PixiJS (2D WebGL with faked 3D perspective via scaling/positioning)
- **Layout:** Highway replaces instrument visualizations entirely during `playing` state
- **Scope:** Gameplay phase only — countdown, results, exercise selection remain as current React/Framer Motion
- **Architecture:** Full PixiJS canvas (highway + notes + effects + HUD). No DOM overlay hybrid.

## Architecture

```
ExercisePlayer (React)
  sessionState === 'playing'
    RhythmHighway (React wrapper)
      PixiJS Application
        Highway Layer   — road, rails, grid, starfield
        Notes Layer     — scrolling note sprites
        Effects Layer   — particles, flashes, grade text
        HUD Layer       — score, combo, accuracy, progress
  sessionState !== 'playing'
    Existing React UI (unchanged)
```

**Core principle:** `useExerciseSession` remains the single source of truth. PixiJS reads from it via refs and never writes back. All scoring, onset detection, and state transitions stay in React.

## File Structure

### New files

```
components/play-sense/rhythm-highway/
  RhythmHighway.tsx     — React wrapper, mounts/unmounts PixiJS app, bridges refs
  HighwayApp.ts         — PixiJS Application setup, render loop, layer orchestration
  Highway.ts            — Background: perspective road, gold edge rails, lane dividers,
                          beat grid lines, starfield particles
  NoteManager.ts        — Creates/positions/recycles note sprites from ExerciseEvent[],
                          handles depth-scaling, lane assignment, sustained note trails
  HitEffects.ts         — Particle burst system (per-grade), floating grade text,
                          receptor flash, combo fire embers, speed lines
  HUD.ts                — Bitmap font rendering for score, combo counter + fire bar,
                          accuracy ring, progress bar, BPM, exercise title
  constants.ts          — Colors, sizes, timing windows, particle configs
```

### Modified files

- `exercise-player.tsx` — Conditionally render `<RhythmHighway>` when `sessionState === 'playing'` instead of `<VisualizationPanel>`
- No other existing files are modified

### Untouched (zero changes)

- `useExerciseSession` hook
- `scoring.ts`, `exercise-utils.ts`
- All onset detection hooks (`use-onset-detection.ts`, `use-playsense-onsets.ts`, `use-pitch-detection.ts`)
- `visualization-panel.tsx` (still used for countdown)
- `results-summary.tsx`, `now-playing-bar.tsx`
- All Supabase actions and persistence

## Visual Elements

### Highway (background layer)

- Faked 3D perspective: trapezoid shape, wide at bottom (near), narrow at top (far)
- Glowing gold edge rails (`#d4a854`) with soft bloom glow
- Lane dividers: one per drum surface or note lane, faint white, opacity fading into distance
- Beat grid lines: horizontal lines spaced by beat, scrolling toward player, subtle pulse on downbeats
- Background: deep purple-black gradient (`#1a0f2e` → `#0a0a0a` → `#050510`) with particle starfield

### Notes (gameplay layer)

- Each `ExerciseEvent` becomes a note sprite on the highway
- Lane assignment:
  - **Percussion:** `event.surface` maps to lane (e.g., quinto=lane 0, conga=lane 1, tumba=lane 2)
  - **Melodic:** pitch range quantized into lanes
- Depth positioning: based on timing difference between event timestamp and current playhead
- As notes approach: scale up (small → large), opacity increases (faded → vivid), glow intensifies
- Lane colors: quinto = `#e74c3c` (red), conga = `#3498db` (blue), tumba = `#2ecc71` (green)
- Sustained notes (`duration > 0`): glowing trail/bar extending behind the note head

### Hit Zone

- Glowing horizontal line near canvas bottom
- Receptor pads per lane: outlined boxes with lane color
- On hit detection (triggered by `lastHitGrade` change):
  - **Perfect:** Gold burst (12 particles), bright flash, "+PERFECT" floats up, `#ffd93d`
  - **Good:** Yellow burst (8 particles), "+GOOD", `#eab308`
  - **OK:** Orange pulse (4 particles), "+OK", `#f97316`
  - **Miss:** Note turns red, fades out, receptor dims, no particles

### Particle Effects

- **Hit bursts:** 8-12 particles radiating from receptor, color-matched to grade, 0.5s lifetime
- **Combo fire:** At 10+ combo, persistent ember particles drift up along rails
- **Speed lines:** Faint lines from vanishing point, intensity scales with combo multiplier

### HUD (bitmap font, rendered in PixiJS)

- **Top-left:** Combo counter (large number) + "COMBO" label + fire progress bar
- **Top-right:** Score (large, white) + "SCORE" label + "+N" pop animation on hit
- **Top-center:** Accuracy % inside a circular ring indicator
- **Bottom:** Progress bar (gold gradient fill) + time elapsed/remaining + exercise title + BPM

## Data Flow

```
useExerciseSession hook
  ├── exercise, eventResults        → props (initial setup + event result tracking)
  ├── playheadProgress              → ref (read every frame for note scrolling)
  ├── currentScore, currentCombo    → ref (read every frame for HUD updates)
  ├── currentAccuracy, tempoDrift   → ref (read every frame for HUD)
  ├── lastHitGrade                  → useEffect callback (triggers particle burst)
  ├── eventResults.length           → useEffect callback (triggers hit animation on specific lane)
  └── metronomeBeat, metronomeDownbeat → ref (beat grid pulse, visual metronome)
```

**Why refs:** The PixiJS render loop runs at 60fps via `requestAnimationFrame`. Reading React state would cause re-renders. Refs provide zero-overhead reads from the game loop.

## Lifecycle

1. `sessionState` transitions to `playing` → React mounts `<RhythmHighway>`
2. `RhythmHighway` creates PixiJS `Application`, appends canvas to container div
3. `HighwayApp` initializes layers, `NoteManager` pre-computes note positions from `exercise.events`
4. Render loop starts: each frame reads `playheadProgress` ref, updates note Y positions, checks for notes passing hit zone, updates HUD values
5. React `useEffect` watches `lastHitGrade` / `eventResults.length` changes → calls `HighwayApp.triggerHitEffect(lane, grade)`
6. `sessionState` leaves `playing` → React unmounts `<RhythmHighway>`, PixiJS app is destroyed, WebGL context released

## Lane Mapping

### Percussion instruments

| Instrument | Lanes | Colors |
|-----------|-------|--------|
| Conga | quinto, conga, tumba | red, blue, green |
| Timbale | macho, hembra, campana, cencerro, jamblock, cascara | 6 distinct colors |
| Bongo, clave, cowbell, guiro | technique-based (open, slap, mute, etc.) | 2-4 lanes |

### Melodic instruments

| Instrument | Lane strategy |
|-----------|--------------|
| Guitar, bass, tres, cuatro | Fret/string quantized into 4-6 lanes |
| Piano | Octave or note-range lanes |
| Trumpet, sax, flute, violin | Pitch-range lanes |

Lane count adapts to the instrument. The highway width and divider count adjust dynamically.

## Performance Considerations

- **Sprite pooling:** Pre-allocate note sprites and recycle them as they pass the hit zone (avoid GC)
- **Particle pooling:** Fixed particle pool per effect type, reuse rather than create/destroy
- **Bitmap fonts:** Pre-rendered text atlas for HUD — no Canvas2D text rendering per frame
- **Viewport culling:** Only update/render notes within visible highway range
- **ResizeObserver:** Responsive canvas sizing, matching the current `VisualizationPanel` approach
- **WebGL context:** Single PixiJS application, destroyed on unmount to free GPU resources

## Dependencies

- `pixi.js` (v8.x) — Core rendering engine
- `@pixi/particle-emitter` — Particle effects (optional, can hand-roll if lighter)
- No other new dependencies

## Verification Plan

1. **Unit test NoteManager:** Given an exercise definition and a playhead progress value, verify note positions are computed correctly
2. **Visual smoke test:** Load a conga exercise, verify notes scroll, hit zone reacts to onset events
3. **Performance test:** Run a 120 BPM exercise with 50+ events, verify consistent 60fps on mid-range hardware
4. **Integration test:** Complete a full session (idle → select → countdown → play → results), verify scores persist correctly to Supabase
5. **Responsive test:** Resize browser window during gameplay, verify canvas adapts without visual artifacts
6. **Instrument coverage:** Test with at least one percussion (conga) and one melodic (guitar) exercise to verify lane mapping
