# PlaySense BLE Device Integration — Design Spec

## Context

PlaySense is a physical device with 6 piezo sensors and a microphone that connects to a computer via Bluetooth Low Energy (BLE). Students place piezos on their congas or timbales, and the device detects hits directly from the drum surface — providing more accurate and instrument-specific input than the current browser microphone approach.

The current app uses browser mic → AudioWorklet → onset detection for all hit detection. This spec adds BLE as an alternative input source that coexists with the mic-based flow. Users choose their input method via the existing audio mode prompt.

## Scope

**In scope:**
- BLE connection management (connect, disconnect, reconnect, persist across exercises)
- Piezo-to-drum surface mapping for congas (3 piezos) and timbales (6 piezos)
- Converting BLE hit events into the existing `OnsetEvent` format
- Extending exercises and scoring to track which drum surface was hit
- "PlaySense Device" as a third audio mode option (alongside headphones/speaker-safe)
- Web Bluetooth API browser compatibility detection

**Out of scope (deferred):**
- Mic-based technique detection (open/slap/mute classification)
- Instruments beyond congas and timbales
- BLE-specific latency calibration
- Device firmware updates or configuration

## Architecture

### Data Flow

```
PlaySense BLE Device
  → BLE notification: { piezos: [v1..v6], mic: number }
    → PlaysenseContext (connection lifecycle, raw data transport)
      → usePlaysenseOnsets (piezo → OnsetEvent with surface)
        → useExerciseSession (dual-source: BLE or mic based on audioMode)
          → gradeSingleOnset(..., detectedSurface)
            → EventResult { ..., surfaceCorrect, detectedSurface }
```

### New Files

#### 1. `lib/play-sense/playsense-mappings.ts`

Pure data — no React. Defines piezo-to-drum mappings per instrument.

```typescript
export type DrumSurface = string

export interface PlaySenseMapping {
  instrument: 'conga' | 'timbale'
  piezoMap: Record<number, DrumSurface>  // piezo index (0-5) → surface name
  useMic: boolean
}

export const CONGA_MAPPING: PlaySenseMapping = {
  instrument: 'conga',
  piezoMap: { 0: 'quinto', 1: 'conga', 2: 'tumba' },
  useMic: true,
}

export const TIMBALE_MAPPING: PlaySenseMapping = {
  instrument: 'timbale',
  piezoMap: {
    0: 'macho', 1: 'hembra', 2: 'campana',
    3: 'cencerro', 4: 'jamblock', 5: 'cascara',
  },
  useMic: false,
}

export const PLAYSENSE_MAPPINGS: Record<string, PlaySenseMapping> = {
  conga: CONGA_MAPPING,
  timbale: TIMBALE_MAPPING,
}

// Instruments that support PlaySense device input
export const PLAYSENSE_INSTRUMENTS = new Set(['conga', 'timbale'])

export function getPlaySenseMapping(instrument: string): PlaySenseMapping | null {
  return PLAYSENSE_MAPPINGS[instrument] ?? null
}
```

#### 2. `contexts/playsense-context.tsx`

App-level React context provider for BLE connection management. Added to `app/layout.tsx`.

**State:**
- `connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error'`
- `error: string | null`
- `isSupported: boolean` — checks `navigator.bluetooth` existence
- `lastReading: { piezos: number[], mic: number, receivedAt: number } | null`

**Methods:**
- `connect(): Promise<void>` — triggers `navigator.bluetooth.requestDevice()` with device name filter "PlaySense" and service UUID `12345678-1234-1234-1234-123456789abc`
- `disconnect(): void` — disconnects GATT, cleans up listeners

**BLE constants:**
- Service UUID: `12345678-1234-1234-1234-123456789abc`
- Characteristic UUID: `abcd1234-5678-1234-5678-abcdef123456`

**Internal behavior:**
- On `characteristicvaluechanged`: decode DataView as UTF-8, JSON.parse, update `lastReading` with `receivedAt: performance.now()`
- On `gattserverdisconnected`: set status to `'disconnected'`
- Store `BluetoothDevice` ref for reconnection without re-pairing
- Cleanup on unmount: disconnect if connected

#### 3. `hooks/use-playsense-onsets.ts`

Converts BLE readings into `OnsetEvent[]`. Mirrors the return shape of `useOnsetDetection` so `useExerciseSession` can swap between them.

**Interface:**
```typescript
interface UsePlaysenseOnsetsResult {
  isListening: boolean
  hasPermission: boolean | null
  error: string | null
  inputLevel: number
  recentOnsets: OnsetEvent[]
  audioContext: AudioContext | null
  workletNode: null  // not used, but matches interface
  startListening: () => Promise<AudioContext | null>
  stopListening: () => void
  clearOnsets: () => void
}
```

**Parameters:** `instrument: Instrument | null`

**Logic:**
- Consumes `PlaysenseContext` for `lastReading` and `connectionStatus`
- On each new `lastReading`, for each piezo index where `value > 0`:
  - Look up `DrumSurface` from `getPlaySenseMapping(instrument)`
  - If piezo index is not in the mapping, ignore (unused piezo)
  - Create `OnsetEvent`:
    - `timestamp`: `audioContext.currentTime` (from a locally managed AudioContext)
    - `energy`: piezo value (raw, not normalized — device handles detection)
    - `surface`: the mapped DrumSurface name
- Append to `recentOnsets` array (cap at 500, same as mic hook)
- `inputLevel`: `Math.max(...piezos) / 4095` for visual meter
- `startListening()`: creates AudioContext (needed for metronome/timing), triggers `playsenseContext.connect()` if not already connected, returns the AudioContext
- `stopListening()`: closes AudioContext, does NOT disconnect BLE (connection persists)
- `clearOnsets()`: resets recentOnsets to `[]`

### Type Extensions

All changes are additive and backward-compatible.

#### `lib/play-sense/types.ts`

**`OnsetEvent`** — add optional `surface`:
```typescript
export interface OnsetEvent {
  timestamp: number
  energy: number
  frequency?: number | null
  midiNote?: number | null
  surface?: string | null  // NEW: drum surface name (BLE mode only)
}
```

**`ExerciseEvent`** — add optional `surface`:
```typescript
export interface ExerciseEvent {
  // ... existing fields ...
  surface?: string  // NEW: expected drum surface (e.g. 'quinto', 'macho')
}
```

**`EventResult`** — add surface tracking:
```typescript
export interface EventResult {
  // ... existing fields ...
  surfaceCorrect?: boolean | null  // NEW: whether correct drum was hit
  detectedSurface?: string | null  // NEW: which drum was actually hit
}
```

**`AudioMode`** in `hooks/use-exercise-session.ts`:
```typescript
export type AudioMode = 'headphones' | 'speaker-safe' | 'playsense'
```

Update `loadStoredAudioMode()` to accept `'playsense'` as a valid stored value.

#### `lib/play-sense/scoring.ts`

**`ExpectedEvent`** — add optional `expectedSurface`:
```typescript
export interface ExpectedEvent {
  // ... existing fields ...
  expectedSurface?: string  // NEW: expected drum surface
}
```

### Scoring Changes

#### `lib/play-sense/exercise-utils.ts` — `generateExpectedTimestamps()`

Propagate `surface` from `ExerciseEvent` to `ExpectedEvent`:
```typescript
results.push({
  eventIndex: results.length,
  timestamp,
  expectedPitch: event.expectedPitch,
  expectedTechnique: event.technique,
  expectedDurationSec: event.duration * beatDuration,
  expectedSurface: event.surface,  // NEW
})
```

#### `lib/play-sense/scoring.ts` — `gradeSingleOnset()`

Add `detectedSurface` parameter:
```typescript
export function gradeSingleOnset(
  onsetTimestamp: number,
  onsetEnergy: number,
  expectedEvents: ExpectedEvent[],
  matchedIndices: Set<number>,
  difficulty: Difficulty,
  calibrationOffsetSec: number = 0,
  widenMs: number = 0,
  instrumentCategory: InstrumentCategory = 'percussion',
  detectedMidiNote?: number | null,
  detectedFrequency?: number | null,
  detectedSurface?: string | null  // NEW
): EventResult | null
```

After existing pitch scoring, add surface scoring:
```typescript
let surfaceCorrect: boolean | null = null
if (matched.expectedSurface && detectedSurface != null) {
  surfaceCorrect = detectedSurface === matched.expectedSurface
  if (!surfaceCorrect) {
    grade = 'miss'  // wrong drum = miss
  }
}
// If exercise expects a surface but onset has none (mic mode), don't penalize
// surfaceCorrect stays null
```

Return `surfaceCorrect` and `detectedSurface` in the `EventResult`.

### Session Hook Changes (`hooks/use-exercise-session.ts`)

**Dual-source pattern.** Both hooks are always instantiated (React rules). Only the active one's `startListening()` is called.

```typescript
// Always instantiate both (hooks can't be conditional)
const micOnsets = useOnsetDetection({
  noisyRoomMode,
  instrument: exercise?.instrument,
  audioMode: audioMode ?? undefined,
})

const bleOnsets = usePlaysenseOnsets(exercise?.instrument ?? null)

// Select active source
const isPlaysenseMode = audioMode === 'playsense'
const activeOnsets = isPlaysenseMode ? bleOnsets : micOnsets

// Destructure the active source for use in the rest of the hook
const {
  isListening, hasPermission, error: audioError,
  inputLevel, recentOnsets, startListening, stopListening, clearOnsets,
} = activeOnsets
```

**Onset processing `useEffect`** — pass `onset.surface` to grading:
```typescript
const result = gradeSingleOnset(
  onset.timestamp - exerciseStartTimeRef.current,
  onset.energy,
  expectedEventsRef.current,
  matchedIndicesRef.current,
  exercise.difficulty,
  calibOffset,
  widenMs,
  category,
  detectedMidi,
  detectedFreq,
  onset.surface ?? null  // NEW: pass surface from BLE onset
)
```

**Calibration skip:** When `audioMode === 'playsense'`, the calibration step can be skipped (BLE has no consistent audio latency to calibrate). The UI flow should go directly from audio mode selection → countdown → playing.

### UI Changes

#### `components/play-sense/audio-mode-prompt.tsx`

**New prop:** `instrument?: Instrument | null`

Add a third button conditionally shown when `instrument` is in `PLAYSENSE_INSTRUMENTS`:

- Icon: Bluetooth icon (from lucide-react)
- Label: "PlaySense"
- Subtitle: "Best accuracy" (since piezos are more accurate than mic)
- On click: call `playsenseContext.connect()`. If successful, call `onSelect('playsense')`. If user cancels BLE dialog or error occurs, show inline error message.
- If `!playsenseContext.isSupported`, show the button disabled with tooltip "Requires Chrome or Edge browser"

#### `components/play-sense/exercise-player.tsx`

Pass exercise instrument to AudioModePrompt:
```tsx
<AudioModePrompt
  onSelect={session.setAudioMode}
  instrument={session.exercise?.instrument}
/>
```

#### `components/play-sense/now-playing-bar.tsx`

When `audioMode === 'playsense'`:
- Show Bluetooth icon + "PlaySense" label instead of headphones/speaker icon
- Hide "Test Mic" button (no mic to test)
- Hide "Noisy Room" toggle (irrelevant for piezo input)

#### `app/layout.tsx`

Add `PlaysenseProvider`:
```tsx
<ThemeProvider>
  <CourseModeProvider>
    <PlaysenseProvider>
      <PageLoadingProvider>
        {children}
      </PageLoadingProvider>
    </PlaysenseProvider>
  </CourseModeProvider>
</ThemeProvider>
```

### Browser Compatibility

Web Bluetooth API is only available in Chromium browsers (Chrome, Edge, Opera). Not supported in Safari or Firefox.

`PlaysenseContext` checks `navigator.bluetooth` on mount and exposes `isSupported: boolean`. The UI hides or disables the PlaySense option when unsupported.

### BLE Timing Considerations

BLE has variable latency (7.5ms–30ms per connection interval). Unlike mic latency which is consistent and can be calibrated, BLE jitter is inherent. For this implementation, we accept the BLE jitter as-is. The tolerance windows (perfect: 20-40ms, good: 40-70ms, ok: 65-110ms depending on difficulty) are large enough to absorb typical BLE jitter.

Future improvement: add BLE-specific calibration or use device-side timestamps if the firmware supports it.

## Verification

### Manual Testing
1. **BLE connection:** Open PlaySense exercise, select "PlaySense" audio mode, pair with device. Verify connection indicator shows "Connected."
2. **Hit detection:** Start a conga exercise, hit each drum. Verify correct drum surfaces are detected (check via dev tools or visual feedback).
3. **Scoring:** Play through an exercise with `surface` fields on events. Verify correct-drum hits are scored normally and wrong-drum hits are marked as misses.
4. **Backward compat:** Play an exercise without `surface` fields using mic mode. Verify scoring works identically to before.
5. **Connection persistence:** Complete an exercise, go back to exercise list, start another. Verify BLE stays connected without re-pairing.
6. **Disconnect handling:** Turn off BLE device mid-exercise. Verify graceful error handling.
7. **Browser compat:** Open in Safari/Firefox. Verify PlaySense option is hidden or disabled.

### Exercises Needed
- Create at least one conga exercise with `surface` fields on events (quinto/conga/tumba)
- Create at least one timbale exercise with `surface` fields on events (macho/hembra/campana/cencerro/jamblock/cascara)

## Files Modified (Summary)

| File | Change |
|------|--------|
| `lib/play-sense/playsense-mappings.ts` | **NEW** — piezo-to-drum mappings |
| `contexts/playsense-context.tsx` | **NEW** — BLE connection provider |
| `hooks/use-playsense-onsets.ts` | **NEW** — BLE-to-OnsetEvent adapter |
| `lib/play-sense/types.ts` | Add `surface` to OnsetEvent, ExerciseEvent, EventResult |
| `lib/play-sense/scoring.ts` | Add `expectedSurface` to ExpectedEvent, `detectedSurface` param to `gradeSingleOnset` |
| `lib/play-sense/exercise-utils.ts` | Propagate `surface` in `generateExpectedTimestamps` |
| `hooks/use-exercise-session.ts` | Dual-source pattern, extend AudioMode, pass surface to grading |
| `components/play-sense/audio-mode-prompt.tsx` | Add PlaySense button (conditional) |
| `components/play-sense/exercise-player.tsx` | Pass instrument to AudioModePrompt |
| `components/play-sense/now-playing-bar.tsx` | PlaySense mode indicator |
| `app/layout.tsx` | Add PlaysenseProvider |
