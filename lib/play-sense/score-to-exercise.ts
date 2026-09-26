// Convert a PlaySense Studio ScoreDocument (the notation the admin builds + syncs
// to video) into the ExerciseDefinition the rhythm-highway + grading engine
// consumes. This is the single-source-of-truth bridge: the admin authors ONE
// score, and the falling-notes "rockband" test view is derived from it.
//
// Pure function — no DOM, no I/O. See score-to-exercise.test.ts for the contract.

import type {
  ScoreDocument,
  Track,
  Instrument as ScoreInstrument,
  Note,
  Chord,
} from '@/components/playsense-studio/shared/score-model/types'
import { beatLengthInQN, measureLengthInQN } from '@/lib/playsense-studio/time-mapping'
import { resolvePercStroke, percussionNotation, isPercussion } from '@/lib/playsense-studio/perc-strokes'
import { midiToKeyString } from '@/lib/playsense-studio/score-to-vexflow'
import { eventArticulations } from '@/components/playsense-studio/shared/score-model/accessors'
import type {
  ExerciseDefinition,
  ExerciseEvent,
  ExerciseGrid,
  Instrument,
  Technique,
  Difficulty,
  Hand,
} from '@/lib/play-sense/types'

export interface ScoreToExerciseOptions {
  /** Which track in the score the student plays/gets graded on. Default 0. */
  trackIndex?: number
  /** Difficulty drives the timing tolerance windows. Default 'intermediate'. */
  difficulty?: Difficulty
  /** Media URL (video/audio) the highway syncs to. */
  audioUrl?: string
  id?: string
  title?: string
  description?: string
}

// Score-model instrument → play-sense engine instrument.
const INSTRUMENT_MAP: Record<ScoreInstrument, Instrument> = {
  guitar: 'guitar',
  bass: 'bass',
  tres: 'tres',
  cuatro: 'cuatro',
  tiple: 'guitar',
  ukulele: 'guitar',
  mandolin: 'guitar',
  piano: 'piano',
  staff: 'piano',
  'perc-conga': 'conga',
  'perc-bongo': 'bongo',
  'perc-timbal': 'timbale',
  'perc-clave': 'clave',
  'perc-kit': 'conga', // no kit in the play-sense vocabulary; nearest fallback
}

// Per-stroke (by stroke id) technique + drum surface for percussion grading.
// Surfaces follow lib/play-sense/playsense-mappings.ts (conga: quinto/conga/tumba,
// timbale: macho/hembra/cascara/…).
const STROKE_INFO: Record<string, { technique: Technique; surface: string }> = {
  // conga
  'open-high': { technique: 'open', surface: 'quinto' },
  slap: { technique: 'slap', surface: 'quinto' },
  'open-low': { technique: 'open', surface: 'tumba' },
  mute: { technique: 'mute', surface: 'quinto' },
  bass: { technique: 'bass', surface: 'quinto' },
  tip: { technique: 'tip', surface: 'quinto' },
  'pressed-slap': { technique: 'slap', surface: 'quinto' },
  'open-middle': { technique: 'open', surface: 'conga' },
  // bongo
  'macho-open': { technique: 'open', surface: 'macho' },
  'macho-slap': { technique: 'slap', surface: 'macho' },
  'hembra-open': { technique: 'open', surface: 'hembra' },
  'hembra-slap': { technique: 'slap', surface: 'hembra' },
  // timbal
  cascara: { technique: 'shell', surface: 'cascara' },
  high: { technique: 'open', surface: 'macho' },
  low: { technique: 'open', surface: 'hembra' },
  rim: { technique: 'rim', surface: 'macho' },
  'high-mute': { technique: 'mute', surface: 'macho' },
  'low-mute': { technique: 'mute', surface: 'hembra' },
  'low-cross-stick': { technique: 'rim', surface: 'hembra' },
  'cascara-low': { technique: 'shell', surface: 'cascara' },
  'jam-block': { technique: 'tip', surface: 'jamblock' },
  'timbal-bell': { technique: 'bell', surface: 'campana' },
  'bongo-bell-mouth': { technique: 'bell', surface: 'cencerro' },
  'bongo-bell-body': { technique: 'tip', surface: 'cencerro' },
  'chacha-bell-mouth': { technique: 'bell', surface: 'campana' },
  'chacha-bell-body': { technique: 'tip', surface: 'campana' },
  cymbal: { technique: 'open', surface: 'cymbal' },
  // clave
  stroke: { technique: 'tip', surface: 'clave' },
}

function mapInstrument(score: ScoreInstrument): Instrument {
  return INSTRUMENT_MAP[score] ?? 'conga'
}

// MIDI → display note name like "C4" / "Eb3" (derived from the vexflow key string).
function midiToNoteName(midi: number, keyFifths: number): string {
  const key = midiToKeyString(midi, { keyFifths }) // e.g. "c#/4"
  const [pitch, octave] = key.split('/')
  return pitch.charAt(0).toUpperCase() + pitch.slice(1) + octave
}

/**
 * The studio stores tempo as quarter notes per minute; the engine counts beats
 * in the meter's denominator unit (beatToTimestamp: beat * 60 / bpm). Convert,
 * so 6/8 and 2/2 exercises run at the same speed the studio shows.
 */
function engineBpm(quarterNoteBpm: number, timeSignature: [number, number]): number {
  return quarterNoteBpm / beatLengthInQN(timeSignature)
}

/**
 * Build the per-measure timing grid for a track: where each measure starts (in
 * seconds and quarter notes), and the meter in force during it. Honours
 * mid-score time-signature changes; the engine's uniform `bpm` + `timeSignature`
 * only ever reflect measure 1.
 *
 * Honours `m.tempoChange` (quarter-note BPM, in force from that measure to the
 * next one that sets it) only when `score.tempoMarksConfirmed === true` — the
 * admin has reviewed the per-bar marks and confirmed they're intentional.
 * Until then every measure runs at `score.initialTempo`: live scores can carry
 * stale per-measure tempo values left over from MusicXML import that disagree
 * with the admin-set `initialTempo` (the Studio's only tempo control before
 * marks are confirmed), so honouring them un-reviewed would re-time live
 * grading against a value the admin never set.
 */
export function buildExerciseGrid(score: ScoreDocument, track: Track): ExerciseGrid {
  const measureStartSec = [0], measureStartQN = [0], secPerQN: number[] = [], beatQN: number[] = []
  let ts = score.initialTimeSignature
  let spq = 60 / score.initialTempo
  for (const m of track.measures) {
    if (m.timeSignature) ts = m.timeSignature
    if (score.tempoMarksConfirmed && m.tempoChange !== undefined) spq = 60 / m.tempoChange
    const bar = measureLengthInQN(ts)
    secPerQN.push(spq)
    beatQN.push(beatLengthInQN(ts))
    measureStartSec.push(measureStartSec[measureStartSec.length - 1] + bar * spq)
    measureStartQN.push(measureStartQN[measureStartQN.length - 1] + bar)
  }
  return { measureStartSec, measureStartQN, secPerQN, beatQN }
}

/**
 * Build an ExerciseDefinition from one track of a score.
 * Rests advance the cursor but emit no event. Chords emit one event per note.
 */
export function scoreToExerciseDefinition(
  score: ScoreDocument,
  options: ScoreToExerciseOptions = {}
): ExerciseDefinition {
  const trackIndex = options.trackIndex ?? 0
  const track: Track | undefined = score.tracks[trackIndex] ?? score.tracks[0]

  if (!track) {
    return {
      id: options.id ?? 'score-exercise',
      title: options.title ?? score.title,
      description: options.description ?? '',
      instrument: 'conga',
      bpm: engineBpm(score.initialTempo, score.initialTimeSignature),
      timeSignature: score.initialTimeSignature,
      swing: 0,
      difficulty: options.difficulty ?? 'intermediate',
      measures: 0,
      loopCount: 1,
      events: [],
      audioUrl: options.audioUrl,
    }
  }

  const instrument = mapInstrument(track.instrument)
  const perc = isPercussion(track.instrument)
  const events: ExerciseEvent[] = []

  let currentTimeSig = score.initialTimeSignature
  let currentKeyFifths = score.initialKeyFifths
  let hand: Hand = 'R'
  let chordCounter = 0
  let continuations = new Map<number, { event: ExerciseEvent; beatQN: number }>()

  for (const measure of track.measures) {
    if (measure.timeSignature) currentTimeSig = measure.timeSignature
    if (measure.keyFifths !== undefined) currentKeyFifths = measure.keyFifths
    const beatQN = beatLengthInQN(currentTimeSig)

    // Use the first voice for grading (v1 supports up to 2; the melody/primary
    // voice is voice 1).
    const voice = measure.voices.find((v) => v.number === 1) ?? measure.voices[0]
    if (!voice) { continuations.clear(); continue }

    let qnIntoMeasure = 0
    for (const ev of voice.events) {
      const durationQN = ev.durationQN
      if (ev.kind === 'rest') {
        continuations.clear()
        qnIntoMeasure += durationQN
        continue
      }

      const beat = qnIntoMeasure / beatQN + 1
      const durationBeats = durationQN / beatQN
      const accent = eventArticulations(ev).includes('accent')

      const pitches = ev.kind === 'chord' ? (ev as Chord).notes : [ev as Note]
      const midis = pitches.map(n => n.midi)

      // Tag pitched chords so the scorer can grade the notes as one set. The
      // notes still emit as separate events (cardinality/rendering unchanged) —
      // only grading uses the shared id. Single notes and percussion get none.
      const attacks = midis.filter(midi => !continuations.has(midi))
      const chordId = !perc && attacks.length > 1 ? `c${chordCounter++}` : undefined
      const nextContinuations = new Map<number, { event: ExerciseEvent; beatQN: number }>()

      for (const n of pitches) {
        const midi = n.midi
        const tiesForward = ev.tieToNext || (ev.kind === 'chord' && ev.notes.some(n => n.midi === midi && n.tieToNext))
        const held = continuations.get(midi)
        if (held) {
          held.event.duration += durationQN / held.beatQN
          if (tiesForward) nextContinuations.set(midi, held)
          continue
        }
        let vexKey: string
        let technique: Technique = 'open'
        let surface: string | undefined
        let expectedPitch: number | undefined
        let expectedNoteName: string | undefined

        if (perc) {
          const strokeData = resolvePercStroke(track.instrument, n)
          vexKey = percussionNotation(track.instrument, n).staffLine
          const info = strokeData ? STROKE_INFO[strokeData.id] : undefined
          technique = info?.technique ?? 'open'
          surface = info?.surface
        } else {
          vexKey = midiToKeyString(midi, { keyFifths: currentKeyFifths })
          expectedPitch = midi
          expectedNoteName = midiToNoteName(midi, currentKeyFifths)
        }

        const played: ExerciseEvent = {
          beat,
          measure: measure.number,
          instrument,
          technique,
          hand,
          duration: durationBeats,
          vexKey,
          accent,
          expectedPitch,
          expectedNoteName,
          surface,
          chordId,
        }
        events.push(played)
        if (tiesForward) nextContinuations.set(midi, { event: played, beatQN })
      }

      // Alternate hands per struck event for natural sticking/stem direction.
      continuations = nextContinuations
      if (attacks.length) hand = hand === 'R' ? 'L' : 'R'
      qnIntoMeasure += durationQN
    }
    if (Math.abs(qnIntoMeasure - measureLengthInQN(currentTimeSig)) > 1e-6) continuations.clear()
  }

  // The count-in and metronome use `bpm`/`timeSignature` alone (no grid), so
  // they must match bar 1's EFFECTIVE meter — which a measure-1 timeSignature
  // change can override — not just the score's initial one.
  const bar1TimeSignature = track.measures[0]?.timeSignature ?? score.initialTimeSignature

  return {
    id: options.id ?? 'score-exercise',
    title: options.title ?? score.title,
    description: options.description ?? '',
    instrument,
    bpm: engineBpm(score.initialTempo, bar1TimeSignature),
    timeSignature: bar1TimeSignature,
    swing: 0,
    difficulty: options.difficulty ?? 'intermediate',
    measures: track.measures.length,
    loopCount: 1,
    events,
    audioUrl: options.audioUrl,
    grid: buildExerciseGrid(score, track),
  }
}
