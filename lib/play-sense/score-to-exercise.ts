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
import { beatLengthInQN } from '@/lib/playsense-studio/time-mapping'
import { midiToPercStroke, isPercussion } from '@/lib/playsense-studio/perc-strokes'
import { midiToKeyString } from '@/lib/playsense-studio/score-to-vexflow'
import type {
  ExerciseDefinition,
  ExerciseEvent,
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
  'open-low': { technique: 'open', surface: 'conga' },
  mute: { technique: 'mute', surface: 'conga' },
  bass: { technique: 'bass', surface: 'tumba' },
  // bongo
  'macho-open': { technique: 'open', surface: 'macho' },
  'macho-slap': { technique: 'slap', surface: 'macho' },
  'hembra-open': { technique: 'open', surface: 'hembra' },
  'hembra-slap': { technique: 'slap', surface: 'hembra' },
  // timbal
  cascara: { technique: 'shell', surface: 'cascara' },
  high: { technique: 'open', surface: 'macho' },
  low: { technique: 'open', surface: 'hembra' },
  rim: { technique: 'rim', surface: 'cencerro' },
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
      bpm: score.initialTempo,
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

  for (const measure of track.measures) {
    if (measure.timeSignature) currentTimeSig = measure.timeSignature
    if (measure.keyFifths !== undefined) currentKeyFifths = measure.keyFifths
    const beatQN = beatLengthInQN(currentTimeSig)

    // Use the first voice for grading (v1 supports up to 2; the melody/primary
    // voice is voice 1).
    const voice = measure.voices.find((v) => v.number === 1) ?? measure.voices[0]
    if (!voice) continue

    let qnIntoMeasure = 0
    for (const ev of voice.events) {
      const durationQN = ev.durationQN
      if (ev.kind === 'rest') {
        qnIntoMeasure += durationQN
        continue
      }

      const beat = qnIntoMeasure / beatQN + 1
      const durationBeats = durationQN / beatQN
      const accent = ev.articulation === 'accent'

      const midis: number[] =
        ev.kind === 'chord'
          ? (ev as Chord).notes.map((n) => n.midi)
          : [(ev as Note).midi]

      // Tag pitched chords so the scorer can grade the notes as one set. The
      // notes still emit as separate events (cardinality/rendering unchanged) —
      // only grading uses the shared id. Single notes and percussion get none.
      const chordId =
        ev.kind === 'chord' && !perc && midis.length > 1 ? `c${chordCounter++}` : undefined

      for (const midi of midis) {
        let vexKey: string
        let technique: Technique = 'open'
        let surface: string | undefined
        let expectedPitch: number | undefined
        let expectedNoteName: string | undefined

        if (perc) {
          const strokeData = midiToPercStroke(track.instrument, midi)
          vexKey = strokeData?.staffLine ?? 'g/5'
          const info = strokeData ? STROKE_INFO[strokeData.id] : undefined
          technique = info?.technique ?? 'open'
          surface = info?.surface
        } else {
          vexKey = midiToKeyString(midi, { keyFifths: currentKeyFifths })
          expectedPitch = midi
          expectedNoteName = midiToNoteName(midi, currentKeyFifths)
        }

        events.push({
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
        })
      }

      // Alternate hands per struck event for natural sticking/stem direction.
      hand = hand === 'R' ? 'L' : 'R'
      qnIntoMeasure += durationQN
    }
  }

  return {
    id: options.id ?? 'score-exercise',
    title: options.title ?? score.title,
    description: options.description ?? '',
    instrument,
    bpm: score.initialTempo,
    timeSignature: score.initialTimeSignature,
    swing: 0,
    difficulty: options.difficulty ?? 'intermediate',
    measures: track.measures.length,
    loopCount: 1,
    events,
    audioUrl: options.audioUrl,
  }
}
