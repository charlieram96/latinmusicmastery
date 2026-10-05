import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'

export const TIMING_TEST_ITEM = 'f7fee0dd-66bb-4e08-9af0-e38febfa415b'

/** Reversible local experiment: keep the authored rhythm, use a uniform score clock.
 * Never rewrites media, sync maps, backing tracks or remote score records.
 */
export function localExerciseTimingReset(score: ScoreDocument, itemId: string, development: boolean): ScoreDocument {
  if (!development || itemId !== TIMING_TEST_ITEM) return score
  const clean = structuredClone(score)
  clean.tempoMarksConfirmed = false
  delete clean.playbackTempoOverride
  for (const track of clean.tracks) for (const measure of track.measures) {
    delete measure.tempoChange
    for (const voice of measure.voices) for (const event of voice.events) delete event.symbolOffsets
  }
  return clean
}
