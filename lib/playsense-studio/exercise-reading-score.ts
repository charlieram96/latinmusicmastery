import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'

/** A continuous reading copy; authored notation and performance data stay unchanged. */
export function exerciseReadingScore(score: ScoreDocument, passCount: number): ScoreDocument {
  const count = Math.max(1, Math.floor(passCount))
  return { ...score, tracks: score.tracks.map(track => ({ ...track,
    measures: Array.from({ length: count }, (_, pass) => track.measures.map((measure, index) => ({
      ...measure,
      // These measures already occur in performance order. Compact repeat signs
      // would rewind the reading position instead of revealing the next pass.
      repeat: undefined,
      number: pass * track.measures.length + index + 1,
      ...(index === 0 ? {
        tempoChange: measure.tempoChange ?? score.initialTempo,
        timeSignature: measure.timeSignature ?? score.initialTimeSignature,
        keyFifths: measure.keyFifths ?? score.initialKeyFifths,
      } : {}),
    }))).flat(),
  })) }
}

export function exerciseReadingTime(singlePassMs: number, pass: number, passCount: number, passDurationMs: number): number {
  return Math.max(0, Math.min(singlePassMs, passDurationMs))
    + (Math.max(1, Math.min(pass, passCount)) - 1) * passDurationMs
}
