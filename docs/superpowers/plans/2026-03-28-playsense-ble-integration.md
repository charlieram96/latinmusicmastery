# PlaySense BLE Device Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add PlaySense BLE hardware device as an alternative input source for conga and timbale exercises, coexisting with the existing microphone-based flow.

**Architecture:** Three new files (piezo mappings, BLE context provider, BLE onset adapter hook) plus surgical modifications to types, scoring, session hook, and UI components. A dual-source pattern in the session hook lets BLE and mic onsets flow through the same scoring pipeline.

**Tech Stack:** Web Bluetooth API, React Context, Next.js 16, TypeScript

**Spec:** `docs/superpowers/specs/2026-03-28-playsense-ble-integration-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `lib/play-sense/playsense-mappings.ts` | Create | Piezo-to-drum surface mappings per instrument |
| `lib/play-sense/types.ts` | Modify | Add `surface` to OnsetEvent, ExerciseEvent, EventResult |
| `lib/play-sense/scoring.ts` | Modify | Add `expectedSurface` to ExpectedEvent, `detectedSurface` param to `gradeSingleOnset` |
| `lib/play-sense/exercise-utils.ts` | Modify | Propagate `surface` in `generateExpectedTimestamps` |
| `contexts/playsense-context.tsx` | Create | BLE connection lifecycle management (app-level provider) |
| `hooks/use-playsense-onsets.ts` | Create | Convert BLE readings → OnsetEvent[] |
| `hooks/use-exercise-session.ts` | Modify | Dual-source pattern, extend AudioMode, pass surface to grading |
| `components/play-sense/audio-mode-prompt.tsx` | Modify | Add PlaySense button (conditional on instrument) |
| `components/play-sense/exercise-player.tsx` | Modify | Pass instrument to AudioModePrompt |
| `components/play-sense/now-playing-bar.tsx` | Modify | PlaySense mode indicator, hide mic controls |
| `app/layout.tsx` | Modify | Add PlaysenseProvider |

---

### Task 1: Create Piezo-to-Drum Mappings

**Files:**
- Create: `lib/play-sense/playsense-mappings.ts`

- [ ] **Step 1: Create the mappings file**

```typescript
// lib/play-sense/playsense-mappings.ts

export type DrumSurface = string

export interface PlaySenseMapping {
  instrument: 'conga' | 'timbale'
  piezoMap: Record<number, DrumSurface>
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
    0: 'macho',
    1: 'hembra',
    2: 'campana',
    3: 'cencerro',
    4: 'jamblock',
    5: 'cascara',
  },
  useMic: false,
}

export const PLAYSENSE_MAPPINGS: Record<string, PlaySenseMapping> = {
  conga: CONGA_MAPPING,
  timbale: TIMBALE_MAPPING,
}

/** Instruments that support PlaySense device input */
export const PLAYSENSE_INSTRUMENTS = new Set(['conga', 'timbale'])

/** Get the PlaySense mapping for an instrument, or null if unsupported */
export function getPlaySenseMapping(instrument: string): PlaySenseMapping | null {
  return PLAYSENSE_MAPPINGS[instrument] ?? null
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors related to `playsense-mappings.ts`

- [ ] **Step 3: Commit**

```bash
git add lib/play-sense/playsense-mappings.ts
git commit -m "feat: add PlaySense piezo-to-drum surface mappings for congas and timbales"
```

---

### Task 2: Extend Types with Surface Fields

**Files:**
- Modify: `lib/play-sense/types.ts`

- [ ] **Step 1: Add `surface` to `OnsetEvent`**

In `lib/play-sense/types.ts`, find the `OnsetEvent` interface and add the `surface` field:

```typescript
export interface OnsetEvent {
  timestamp: number
  energy: number
  /** Detected frequency in Hz at onset (pitched instruments) */
  frequency?: number | null
  /** Detected MIDI note number at onset */
  midiNote?: number | null
  /** Which drum surface was hit — set by PlaySense BLE device only */
  surface?: string | null
}
```

- [ ] **Step 2: Add `surface` to `ExerciseEvent`**

In the same file, find the `ExerciseEvent` interface and add `surface` after the `expectedNoteName` field:

```typescript
  /** Expected note name for display (e.g. 'C4', 'Eb3') */
  expectedNoteName?: string
  /** Expected drum surface for PlaySense scoring (e.g. 'quinto', 'macho') */
  surface?: string
```

- [ ] **Step 3: Add surface tracking to `EventResult`**

In the same file, find the `EventResult` interface and add after the `durationHeld` field:

```typescript
  /** Duration held in beats (pitched instruments) */
  durationHeld?: number | null
  /** Whether the correct drum surface was hit (PlaySense mode) */
  surfaceCorrect?: boolean | null
  /** Which drum surface was actually hit (PlaySense mode) */
  detectedSurface?: string | null
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors (all new fields are optional)

- [ ] **Step 5: Commit**

```bash
git add lib/play-sense/types.ts
git commit -m "feat: add optional surface fields to OnsetEvent, ExerciseEvent, and EventResult"
```

---

### Task 3: Extend Scoring with Surface Detection

**Files:**
- Modify: `lib/play-sense/scoring.ts`
- Modify: `lib/play-sense/exercise-utils.ts`

- [ ] **Step 1: Add `expectedSurface` to `ExpectedEvent`**

In `lib/play-sense/scoring.ts`, find the `ExpectedEvent` interface and add:

```typescript
export interface ExpectedEvent {
  eventIndex: number
  timestamp: number
  /** Expected MIDI note number for pitched instruments */
  expectedPitch?: number
  /** Expected technique for percussion technique scoring */
  expectedTechnique?: string
  /** Expected duration in seconds for sustain scoring */
  expectedDurationSec?: number
  /** Expected drum surface for PlaySense scoring */
  expectedSurface?: string
}
```

- [ ] **Step 2: Add `detectedSurface` parameter to `gradeSingleOnset`**

In the same file, update the `gradeSingleOnset` function signature. Change from:

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
  detectedFrequency?: number | null
): EventResult | null {
```

To:

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
  detectedSurface?: string | null
): EventResult | null {
```

- [ ] **Step 3: Add surface scoring logic**

In the same function, after the technique tracking block (the `if (instrumentCategory === 'percussion' && matched.expectedTechnique)` block, around line 213) and before `matchedIndices.add(matched.eventIndex)`, add:

```typescript
  // Surface scoring for PlaySense device
  let surfaceCorrect: boolean | null = null
  let detectedSurfaceResult: string | null = detectedSurface ?? null
  if (matched.expectedSurface && detectedSurface != null) {
    surfaceCorrect = detectedSurface === matched.expectedSurface
    if (!surfaceCorrect) {
      grade = 'miss' // wrong drum = miss
    }
  }
```

- [ ] **Step 4: Add surface fields to the return value**

In the same function, update the return object. Change from:

```typescript
  return {
    eventIndex: matched.eventIndex,
    grade,
    offsetMs: Math.round(offsetMs * 100) / 100,
    timing,
    onsetEnergy: onsetEnergy,
    detectedPitch: detectedFrequency ?? null,
    pitchCorrect,
    pitchCents,
    techniqueCorrect,
  }
```

To:

```typescript
  return {
    eventIndex: matched.eventIndex,
    grade,
    offsetMs: Math.round(offsetMs * 100) / 100,
    timing,
    onsetEnergy: onsetEnergy,
    detectedPitch: detectedFrequency ?? null,
    pitchCorrect,
    pitchCents,
    techniqueCorrect,
    surfaceCorrect,
    detectedSurface: detectedSurfaceResult,
  }
```

- [ ] **Step 5: Propagate `surface` in `generateExpectedTimestamps`**

In `lib/play-sense/exercise-utils.ts`, find the `generateExpectedTimestamps` function. In the `results.push` call (around line 63), add `expectedSurface`:

Change from:

```typescript
      results.push({
        eventIndex: results.length,
        timestamp,
        expectedPitch: event.expectedPitch,
        expectedTechnique: event.technique,
        expectedDurationSec: event.duration * beatDuration,
      })
```

To:

```typescript
      results.push({
        eventIndex: results.length,
        timestamp,
        expectedPitch: event.expectedPitch,
        expectedTechnique: event.technique,
        expectedDurationSec: event.duration * beatDuration,
        expectedSurface: event.surface,
      })
```

- [ ] **Step 6: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 7: Commit**

```bash
git add lib/play-sense/scoring.ts lib/play-sense/exercise-utils.ts
git commit -m "feat: add drum surface scoring to gradeSingleOnset and propagate surface in expected timestamps"
```

---

### Task 4: Create PlaysenseContext (BLE Connection Provider)

**Files:**
- Create: `contexts/playsense-context.tsx`

- [ ] **Step 1: Create the context provider**

```typescript
// contexts/playsense-context.tsx
'use client'

import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react'

const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc'
const CHARACTERISTIC_UUID = 'abcd1234-5678-1234-5678-abcdef123456'

export interface PlaysenseReading {
  piezos: number[]
  mic: number
  receivedAt: number
}

export type PlaysenseConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface PlaysenseContextType {
  connectionStatus: PlaysenseConnectionStatus
  isSupported: boolean
  error: string | null
  lastReading: PlaysenseReading | null
  connect: () => Promise<void>
  disconnect: () => void
}

const PlaysenseContext = createContext<PlaysenseContextType | null>(null)

export function PlaysenseProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<PlaysenseConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [lastReading, setLastReading] = useState<PlaysenseReading | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  const deviceRef = useRef<BluetoothDevice | null>(null)
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)

  useEffect(() => {
    setIsSupported(typeof navigator !== 'undefined' && 'bluetooth' in navigator)
  }, [])

  const handleNotification = useCallback((event: Event) => {
    try {
      const target = event.target as BluetoothRemoteGATTCharacteristic
      const text = new TextDecoder().decode(target.value!)
      const data = JSON.parse(text)
      if (Array.isArray(data.piezos)) {
        setLastReading({
          piezos: data.piezos,
          mic: Number(data.mic) || 0,
          receivedAt: performance.now(),
        })
      }
    } catch {
      // Ignore malformed data
    }
  }, [])

  const onDisconnected = useCallback(() => {
    setConnectionStatus('disconnected')
    characteristicRef.current = null
  }, [])

  const connect = useCallback(async () => {
    if (!isSupported) {
      setError('Web Bluetooth is not supported in this browser. Please use Chrome or Edge.')
      setConnectionStatus('error')
      return
    }

    setError(null)
    setConnectionStatus('connecting')

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'PlaySense' }],
        optionalServices: [SERVICE_UUID],
      })

      deviceRef.current = device
      device.addEventListener('gattserverdisconnected', onDisconnected)

      const server = await device.gatt!.connect()
      const service = await server.getPrimaryService(SERVICE_UUID)
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID)

      await characteristic.startNotifications()
      characteristic.addEventListener('characteristicvaluechanged', handleNotification)
      characteristicRef.current = characteristic

      setConnectionStatus('connected')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect to PlaySense device'
      // User cancellation is not an error
      if (message.includes('cancelled') || message.includes('canceled')) {
        setConnectionStatus('disconnected')
        return
      }
      setError(message)
      setConnectionStatus('error')
    }
  }, [isSupported, onDisconnected, handleNotification])

  const disconnect = useCallback(() => {
    if (characteristicRef.current) {
      characteristicRef.current.removeEventListener('characteristicvaluechanged', handleNotification)
      characteristicRef.current = null
    }
    if (deviceRef.current && deviceRef.current.gatt?.connected) {
      deviceRef.current.gatt.disconnect()
    }
    setConnectionStatus('disconnected')
    setLastReading(null)
    setError(null)
  }, [handleNotification])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (characteristicRef.current) {
        characteristicRef.current.removeEventListener('characteristicvaluechanged', handleNotification)
      }
      if (deviceRef.current && deviceRef.current.gatt?.connected) {
        deviceRef.current.gatt.disconnect()
      }
    }
  }, [handleNotification])

  return (
    <PlaysenseContext.Provider
      value={{ connectionStatus, isSupported, error, lastReading, connect, disconnect }}
    >
      {children}
    </PlaysenseContext.Provider>
  )
}

export function usePlaysense() {
  const context = useContext(PlaysenseContext)
  if (!context) {
    throw new Error('usePlaysense must be used within a PlaysenseProvider')
  }
  return context
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add contexts/playsense-context.tsx
git commit -m "feat: add PlaysenseContext for BLE connection lifecycle management"
```

---

### Task 5: Add PlaysenseProvider to App Layout

**Files:**
- Modify: `app/layout.tsx`

- [ ] **Step 1: Add the import**

In `app/layout.tsx`, add after the `CourseModeProvider` import (line 5):

```typescript
import { PlaysenseProvider } from "@/contexts/playsense-context";
```

- [ ] **Step 2: Wrap children with PlaysenseProvider**

In the same file, change the provider nesting from:

```tsx
        <ThemeProvider>
          <CourseModeProvider>
            <PageLoadingProvider>
              {children}
            </PageLoadingProvider>
          </CourseModeProvider>
        </ThemeProvider>
```

To:

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

- [ ] **Step 3: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/layout.tsx
git commit -m "feat: add PlaysenseProvider to app layout for persistent BLE connection"
```

---

### Task 6: Create usePlaysenseOnsets Hook

**Files:**
- Create: `hooks/use-playsense-onsets.ts`

- [ ] **Step 1: Create the hook**

```typescript
// hooks/use-playsense-onsets.ts
'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import type { OnsetEvent, Instrument } from '@/lib/play-sense/types'
import { usePlaysense } from '@/contexts/playsense-context'
import { getPlaySenseMapping } from '@/lib/play-sense/playsense-mappings'

interface UsePlaysenseOnsetsResult {
  isListening: boolean
  hasPermission: boolean | null
  error: string | null
  inputLevel: number
  recentOnsets: OnsetEvent[]
  audioContext: AudioContext | null
  workletNode: null
  startListening: () => Promise<AudioContext | null>
  stopListening: () => void
  clearOnsets: () => void
}

export function usePlaysenseOnsets(
  instrument: Instrument | null
): UsePlaysenseOnsetsResult {
  const playsense = usePlaysense()

  const [isListening, setIsListening] = useState(false)
  const [inputLevel, setInputLevel] = useState(0)
  const [recentOnsets, setRecentOnsets] = useState<OnsetEvent[]>([])

  const audioContextRef = useRef<AudioContext | null>(null)
  const lastReadingRef = useRef<number>(0)

  const clearOnsets = useCallback(() => {
    setRecentOnsets([])
  }, [])

  const stopListening = useCallback(() => {
    setIsListening(false)
    setInputLevel(0)
    // Close AudioContext but do NOT disconnect BLE — connection persists
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
  }, [])

  const startListening = useCallback(async (): Promise<AudioContext | null> => {
    // Create AudioContext for timing (metronome, backing track need it)
    const AudioContextClass =
      typeof window !== 'undefined'
        ? window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        : null
    if (!AudioContextClass) {
      return null
    }

    let audioContext = audioContextRef.current
    if (audioContext && audioContext.state !== 'closed') {
      await audioContext.resume()
    } else {
      audioContext = new AudioContextClass()
      await audioContext.resume()
      audioContextRef.current = audioContext
    }

    // Connect BLE if not already connected
    if (playsense.connectionStatus !== 'connected') {
      await playsense.connect()
    }

    setIsListening(true)
    setRecentOnsets([])
    return audioContext
  }, [playsense])

  // Convert BLE readings to OnsetEvents
  useEffect(() => {
    if (!isListening || !playsense.lastReading || !instrument) return

    const reading = playsense.lastReading

    // Skip if we've already processed this reading
    if (reading.receivedAt <= lastReadingRef.current) return
    lastReadingRef.current = reading.receivedAt

    const mapping = getPlaySenseMapping(instrument)
    if (!mapping) return

    const audioContext = audioContextRef.current
    if (!audioContext || audioContext.state === 'closed') return

    const timestamp = audioContext.currentTime

    // Find all piezos with hits (value > 0)
    const newOnsets: OnsetEvent[] = []
    for (let i = 0; i < reading.piezos.length; i++) {
      const val = reading.piezos[i]
      if (val > 0 && mapping.piezoMap[i] !== undefined) {
        newOnsets.push({
          timestamp,
          energy: val,
          surface: mapping.piezoMap[i],
        })
      }
    }

    if (newOnsets.length > 0) {
      setRecentOnsets((prev) => {
        const next = [...prev, ...newOnsets]
        return next.length > 500 ? next.slice(-500) : next
      })
    }

    // Update input level from max piezo value
    const maxPiezo = Math.max(...reading.piezos, 0)
    setInputLevel(Math.min(maxPiezo / 4095, 1))
  }, [isListening, playsense.lastReading, instrument])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {})
      }
    }
  }, [])

  const hasPermission = playsense.connectionStatus === 'connected' ? true
    : playsense.connectionStatus === 'error' ? false
    : null

  return {
    isListening: isListening && playsense.connectionStatus === 'connected',
    hasPermission,
    error: playsense.error,
    inputLevel,
    recentOnsets,
    audioContext: audioContextRef.current,
    workletNode: null,
    startListening,
    stopListening,
    clearOnsets,
  }
}
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add hooks/use-playsense-onsets.ts
git commit -m "feat: add usePlaysenseOnsets hook to convert BLE readings to OnsetEvents"
```

---

### Task 7: Integrate Dual-Source Pattern in Session Hook

**Files:**
- Modify: `hooks/use-exercise-session.ts`

- [ ] **Step 1: Update AudioMode type and storage validation**

In `hooks/use-exercise-session.ts`, change the `AudioMode` type (line 20):

From:
```typescript
export type AudioMode = 'headphones' | 'speaker-safe'
```

To:
```typescript
export type AudioMode = 'headphones' | 'speaker-safe' | 'playsense'
```

Update `loadStoredAudioMode` (line 24) to accept the new value. Change:

```typescript
  if (stored === 'headphones' || stored === 'speaker-safe') return stored
```

To:

```typescript
  if (stored === 'headphones' || stored === 'speaker-safe' || stored === 'playsense') return stored
```

- [ ] **Step 2: Add import for usePlaysenseOnsets**

Add after the `usePitchDetection` import (line 18):

```typescript
import { usePlaysenseOnsets } from './use-playsense-onsets'
```

- [ ] **Step 3: Implement dual-source pattern**

Replace the current `useOnsetDetection` call and its destructuring (lines 135-146). Change from:

```typescript
  const {
    isListening,
    hasPermission,
    error: audioError,
    inputLevel,
    recentOnsets,
    workletNode,
    startListening,
    stopListening,
    clearOnsets,
  } = useOnsetDetection({ noisyRoomMode, instrument: exercise?.instrument, audioMode: audioMode ?? undefined })
```

To:

```typescript
  const micOnsets = useOnsetDetection({ noisyRoomMode, instrument: exercise?.instrument, audioMode: audioMode ?? undefined })
  const bleOnsets = usePlaysenseOnsets(exercise?.instrument ?? null)

  const isPlaysenseMode = audioMode === 'playsense'
  const activeOnsets = isPlaysenseMode ? bleOnsets : micOnsets

  const {
    isListening,
    hasPermission,
    error: audioError,
    inputLevel,
    recentOnsets,
    startListening,
    stopListening,
    clearOnsets,
  } = activeOnsets

  const workletNode = micOnsets.workletNode
```

- [ ] **Step 4: Pass `onset.surface` to `gradeSingleOnset` in the onset processing effect**

In the onset processing `useEffect` (the one starting around line 221 with `if (sessionState !== 'playing' || !exercise) return`), find the two calls to `gradeSingleOnset`.

For the first call (the deferred pitch grading inside the `setTimeout`, around line 266), add `undefined` as the last argument:

```typescript
          const deferredResult = gradeSingleOnset(
            deferredOnset.timestamp - exerciseStartTimeRef.current,
            deferredOnset.energy,
            expectedEventsRef.current,
            matchedIndicesRef.current,
            exercise.difficulty,
            calibOffset,
            widenMs,
            category,
            delayedMidi,
            delayedFreq ?? undefined,
            deferredOnset.surface ?? undefined
          )
```

For the second call (the main grading, around line 310), add `onset.surface`:

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
        onset.surface ?? undefined
      )
```

- [ ] **Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add hooks/use-exercise-session.ts
git commit -m "feat: implement dual-source pattern in session hook for BLE/mic onset switching"
```

---

### Task 8: Update AudioModePrompt with PlaySense Option

**Files:**
- Modify: `components/play-sense/audio-mode-prompt.tsx`

- [ ] **Step 1: Update imports and props**

In `components/play-sense/audio-mode-prompt.tsx`, update the imports. Change from:

```typescript
import { Headphones, Speaker, AlertTriangle } from 'lucide-react'
import type { AudioMode } from '@/hooks/use-exercise-session'
```

To:

```typescript
import { Headphones, Speaker, AlertTriangle, Bluetooth } from 'lucide-react'
import type { AudioMode } from '@/hooks/use-exercise-session'
import type { Instrument } from '@/lib/play-sense/types'
import { PLAYSENSE_INSTRUMENTS } from '@/lib/play-sense/playsense-mappings'
import { usePlaysense } from '@/contexts/playsense-context'
```

Update the props interface. Change from:

```typescript
interface AudioModePromptProps {
  onSelect: (mode: AudioMode) => void
}
```

To:

```typescript
interface AudioModePromptProps {
  onSelect: (mode: AudioMode) => void
  instrument?: Instrument | null
}
```

- [ ] **Step 2: Add PlaySense connection logic and UI**

Replace the entire `AudioModePrompt` function body with:

```typescript
export function AudioModePrompt({ onSelect, instrument }: AudioModePromptProps) {
  const [showWarning, setShowWarning] = useState(false)
  const [bleError, setBleError] = useState<string | null>(null)
  const [bleConnecting, setBleConnecting] = useState(false)
  const playsense = usePlaysense()

  const showPlaysense = instrument ? PLAYSENSE_INSTRUMENTS.has(instrument) : false

  const handlePlaysenseSelect = async () => {
    setBleError(null)
    if (playsense.connectionStatus === 'connected') {
      onSelect('playsense')
      return
    }
    setBleConnecting(true)
    try {
      await playsense.connect()
      // Check connection status after connect resolves
      // If user cancelled the BLE dialog, status will be 'disconnected'
      // We need a small delay to let state update propagate
      setTimeout(() => {
        setBleConnecting(false)
      }, 100)
    } catch {
      setBleConnecting(false)
      setBleError('Could not connect to PlaySense device.')
    }
  }

  // When BLE connects successfully, auto-select playsense mode
  useEffect(() => {
    if (bleConnecting && playsense.connectionStatus === 'connected') {
      setBleConnecting(false)
      onSelect('playsense')
    } else if (bleConnecting && playsense.connectionStatus === 'error') {
      setBleConnecting(false)
      setBleError(playsense.error || 'Could not connect to PlaySense device.')
    } else if (bleConnecting && playsense.connectionStatus === 'disconnected') {
      // User likely cancelled the BLE dialog
      setBleConnecting(false)
    }
  }, [playsense.connectionStatus, playsense.error, bleConnecting, onSelect])

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-6 p-8 max-w-md mx-auto"
    >
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold text-foreground">How are you listening?</h3>
        <p className="text-sm text-muted-foreground">
          This helps us optimize detection for your setup.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <Button
          variant="outline"
          onClick={() => onSelect('headphones')}
          className="flex-1 h-auto py-4 px-4 flex flex-col items-center gap-2 border-border hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Headphones className="w-8 h-8 text-foreground" />
          <span className="text-sm font-semibold">Headphones</span>
          <span className="text-[11px] text-muted-foreground">Best accuracy</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            if (!showWarning) {
              setShowWarning(true)
            } else {
              onSelect('speaker-safe')
            }
          }}
          className="flex-1 h-auto py-4 px-4 flex flex-col items-center gap-2 border-border hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-colors"
        >
          <Speaker className="w-8 h-8 text-foreground" />
          <span className="text-sm font-semibold">Speakers</span>
          <span className="text-[11px] text-muted-foreground">Reduced accuracy</span>
        </Button>

        {showPlaysense && (
          <Button
            variant="outline"
            onClick={handlePlaysenseSelect}
            disabled={bleConnecting || !playsense.isSupported}
            className="flex-1 h-auto py-4 px-4 flex flex-col items-center gap-2 border-border hover:border-blue-500/50 hover:bg-blue-500/5 transition-colors"
          >
            <Bluetooth className={cn('w-8 h-8', playsense.connectionStatus === 'connected' ? 'text-blue-500' : 'text-foreground')} />
            <span className="text-sm font-semibold">
              {bleConnecting ? 'Connecting...' : 'PlaySense'}
            </span>
            <span className="text-[11px] text-muted-foreground">
              {!playsense.isSupported
                ? 'Chrome/Edge only'
                : playsense.connectionStatus === 'connected'
                  ? 'Connected'
                  : 'Direct sensor'}
            </span>
          </Button>
        )}
      </div>

      {showWarning && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="w-full p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Speaker mode reduces backing track volume and raises detection thresholds to minimize mic bleed. Results may be less accurate.
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSelect('speaker-safe')}
                className="text-xs h-7 px-2 text-yellow-500 hover:text-yellow-400"
              >
                Continue with speakers
              </Button>
            </div>
          </div>
        </motion.div>
      )}

      {bleError && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="w-full p-3 rounded-lg border border-red-500/30 bg-red-500/10"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">{bleError}</p>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
```

- [ ] **Step 3: Add missing `cn` import**

Check if `cn` is already imported. If not, add at the top:

```typescript
import { cn } from '@/lib/utils'
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add components/play-sense/audio-mode-prompt.tsx
git commit -m "feat: add PlaySense device option to AudioModePrompt for conga/timbale exercises"
```

---

### Task 9: Update ExercisePlayer to Pass Instrument to Prompt

**Files:**
- Modify: `components/play-sense/exercise-player.tsx`

- [ ] **Step 1: Pass instrument to AudioModePrompt**

In `components/play-sense/exercise-player.tsx`, find the `AudioModePrompt` usage (around line 210):

Change from:

```tsx
                  <AudioModePrompt onSelect={session.setAudioMode} />
```

To:

```tsx
                  <AudioModePrompt onSelect={session.setAudioMode} instrument={session.exercise?.instrument} />
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add components/play-sense/exercise-player.tsx
git commit -m "feat: pass exercise instrument to AudioModePrompt for PlaySense option visibility"
```

---

### Task 10: Update NowPlayingBar for PlaySense Mode

**Files:**
- Modify: `components/play-sense/now-playing-bar.tsx`

- [ ] **Step 1: Add Bluetooth import**

In `components/play-sense/now-playing-bar.tsx`, update the lucide-react import (line 19). Change from:

```typescript
import {
  Play,
  Square,
  Settings2,
  Loader2,
  Volume2,
  VolumeX,
  Flame,
  Mic,
  Headphones,
  Speaker,
} from 'lucide-react'
```

To:

```typescript
import {
  Play,
  Square,
  Settings2,
  Loader2,
  Volume2,
  VolumeX,
  Flame,
  Mic,
  Headphones,
  Speaker,
  Bluetooth,
} from 'lucide-react'
```

- [ ] **Step 2: Update audio mode indicator in the right column**

Find the audio mode indicator button in the right column (around line 356). Replace the entire `{audioMode && (` block:

Change from:

```tsx
          {audioMode && (
            <button
              onClick={() => onAudioModeChange(audioMode === 'headphones' ? 'speaker-safe' : 'headphones')}
              className="flex items-center gap-2 px-3 h-8 w-full rounded-md hover:bg-secondary/50 transition-colors"
            >
              {audioMode === 'headphones' ? (
                <Headphones className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <Speaker className="w-4 h-4 text-yellow-500 shrink-0" />
              )}
              <span className="text-xs text-muted-foreground">
                {audioMode === 'headphones' ? 'Headphones' : 'Speaker Safe'}
              </span>
              <span className="text-[10px] text-muted-foreground/60 ml-auto">switch</span>
            </button>
          )}
```

To:

```tsx
          {audioMode && (
            <button
              onClick={() => {
                if (audioMode === 'playsense') return // Don't cycle away from PlaySense
                onAudioModeChange(audioMode === 'headphones' ? 'speaker-safe' : 'headphones')
              }}
              className={cn(
                'flex items-center gap-2 px-3 h-8 w-full rounded-md transition-colors',
                audioMode === 'playsense' ? 'cursor-default' : 'hover:bg-secondary/50'
              )}
            >
              {audioMode === 'playsense' ? (
                <Bluetooth className="w-4 h-4 text-blue-500 shrink-0" />
              ) : audioMode === 'headphones' ? (
                <Headphones className="w-4 h-4 text-muted-foreground shrink-0" />
              ) : (
                <Speaker className="w-4 h-4 text-yellow-500 shrink-0" />
              )}
              <span className="text-xs text-muted-foreground">
                {audioMode === 'playsense' ? 'PlaySense' : audioMode === 'headphones' ? 'Headphones' : 'Speaker Safe'}
              </span>
              {audioMode !== 'playsense' && (
                <span className="text-[10px] text-muted-foreground/60 ml-auto">switch</span>
              )}
            </button>
          )}
```

- [ ] **Step 3: Conditionally hide mic controls in PlaySense mode**

Find the mic level + test button section (around line 239). Wrap it in a condition:

Change from:

```tsx
          {/* Mic level + test button */}
          <div className="flex items-center gap-2 h-7">
            <Mic className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
```

To:

```tsx
          {/* Mic level + test button — hidden in PlaySense mode */}
          {audioMode !== 'playsense' && <div className="flex items-center gap-2 h-7">
            <Mic className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
```

And find the closing `</div>` of this mic section (the one with the Test/Stop button, around line 267) and change:

```tsx
          </div>
```

To:

```tsx
          </div>}
```

- [ ] **Step 4: Conditionally hide noisy room toggle in PlaySense mode**

Find the noisy room toggle (around line 373). Wrap it:

Change from:

```tsx
          {/* Noisy room toggle */}
          <div className="flex items-center gap-2 px-3 h-8">
            <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground">Noisy Room</span>
            <div className="ml-auto">
              <Switch
                checked={noisyRoomMode}
                onCheckedChange={onNoisyRoomChange}
              />
            </div>
          </div>
```

To:

```tsx
          {/* Noisy room toggle — hidden in PlaySense mode */}
          {audioMode !== 'playsense' && (
            <div className="flex items-center gap-2 px-3 h-8">
              <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">Noisy Room</span>
              <div className="ml-auto">
                <Switch
                  checked={noisyRoomMode}
                  onCheckedChange={onNoisyRoomChange}
                />
              </div>
            </div>
          )}
```

- [ ] **Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors

- [ ] **Step 6: Commit**

```bash
git add components/play-sense/now-playing-bar.tsx
git commit -m "feat: update NowPlayingBar with PlaySense mode indicator and hide mic controls"
```

---

### Task 11: Build Verification

**Files:** None (read-only verification)

- [ ] **Step 1: Run full TypeScript check**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 2: Run the dev server**

Run: `npm run dev`
Expected: Server starts without errors

- [ ] **Step 3: Manual smoke test**

Open the app in Chrome. Navigate to a conga or timbale exercise. Verify:
1. AudioModePrompt shows three options: Headphones, Speakers, PlaySense
2. For non-conga/timbale exercises, PlaySense button is not shown
3. Clicking PlaySense triggers the browser's BLE pairing dialog
4. Headphones and Speakers modes still work as before

- [ ] **Step 4: Commit any final fixes if needed**

If any issues found during smoke test, fix and commit.
