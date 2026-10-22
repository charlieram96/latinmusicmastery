import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'

/** A display-only excerpt in expanded performance order, matching result tiles. */
export function barPracticeScore(score: ScoreDocument, bar: number, bpm: number): ScoreDocument | null {
  const index = bar - 1
  if (!Number.isInteger(index) || index < 0 || !score.tracks[0]?.measures[index]) return null
  const tracks = score.tracks.flatMap(track => {
    const selected = track.measures[index]
    if (!selected) return []
    let keyFifths = score.initialKeyFifths, timeSignature = score.initialTimeSignature
    let clef = track.measures[0]?.clef
    for (const measure of track.measures.slice(0, index + 1)) {
      keyFifths = measure.keyFifths ?? keyFifths
      timeSignature = measure.timeSignature ?? timeSignature
      clef = measure.clef ?? clef
    }
    return [{ ...track, measures: [{ ...selected, number: bar, tempoChange: bpm, keyFifths, timeSignature, clef,
      repeat: undefined, repeatStart: undefined, repeatEnd: undefined, volta: undefined, endBarline: 'final' as const }] }]
  })
  const ids = new Set(tracks.flatMap(track => track.measures.flatMap(measure => measure.voices.flatMap(voice => voice.events.map(event => event.id)))))
  return { ...score, initialTempo: bpm, playbackTempoOverride: undefined,
    initialTimeSignature: tracks[0].measures[0].timeSignature,
    initialKeyFifths: tracks[0].measures[0].keyFifths,
    tracks, spans: score.spans?.filter(span => ids.has(span.from) && ids.has(span.to)) }
}
