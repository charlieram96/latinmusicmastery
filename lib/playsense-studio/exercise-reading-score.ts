import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'

/** A continuous reading copy; authored notation and performance data stay unchanged. */
export function exerciseReadingScore(score: ScoreDocument, passCount: number): ScoreDocument {
  const count = Math.max(1, Math.floor(passCount))
  return { ...score, tracks: score.tracks.map(track => {
    const first = track.measures[0]
    // Every pass restarts at the score's opening tempo, meter and key. A repeat
    // group that opens the score must carry the same header on each of its
    // passes, or its bars stop matching and the repeat sign is lost.
    const header = first ? {
      tempoChange: first.tempoChange ?? score.initialTempo,
      timeSignature: first.timeSignature ?? score.initialTimeSignature,
      keyFifths: first.keyFifths ?? score.initialKeyFifths,
    } : {}
    const opensScore = (measure: typeof first) =>
      !!first?.repeat && measure.repeat?.id === first.repeat.id && measure.repeat.offset === 0
    return { ...track,
      measures: Array.from({ length: count }, (_, pass) => track.measures.map((measure, index) => ({
        ...measure,
        // Keep authored repeat signs so the staff engraves them (the renderer's
        // repeat projection collapses the written-out bars and rewinds the cursor
        // at the sign, as printed music does). Each reading pass gets its own
        // group id so passes can never be mistaken for one another.
        repeat: measure.repeat ? { ...measure.repeat, id: `${measure.repeat.id}#${pass}` } : undefined,
        number: pass * track.measures.length + index + 1,
        ...(index === 0 || opensScore(measure) ? header : {}),
      }))).flat(),
    }
  }) }
}

export function exerciseReadingTime(singlePassMs: number, pass: number, passCount: number, passDurationMs: number): number {
  return Math.max(0, Math.min(singlePassMs, passDurationMs))
    + (Math.max(1, Math.min(pass, passCount)) - 1) * passDurationMs
}
