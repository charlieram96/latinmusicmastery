export interface ScoreRow { startIndex: number; widths: number[] }

/** Pack each row by its own musical density; a dense bar never widens other rows. */
export function packScoreRows(measureWidths: readonly number[], availableWidth: number): ScoreRow[] {
  const rows: ScoreRow[] = []
  let startIndex = 0
  while (startIndex < measureWidths.length) {
    let count = 1
    let used = measureWidths[startIndex]
    while (count < 3 && startIndex + count < measureWidths.length
      && used + measureWidths[startIndex + count] <= availableWidth) {
      used += measureWidths[startIndex + count]
      count++
    }
    // Give every bar equal breathing room while preserving its required width.
    // An oversized bar occupies a row by itself and remains horizontally readable.
    const extra = Math.max(0, availableWidth - used) / count
    rows.push({ startIndex, widths: measureWidths.slice(startIndex, startIndex + count).map(width => width + extra) })
    startIndex += count
  }
  return rows
}

export interface LessonScoreRow extends ScoreRow { interlude?: 'leading' | 'trailing' }

/** Video time gets a full row; only music participates in measure packing. */
export function packLessonScoreRows(measureWidths: readonly number[], availableWidth: number,
  interludes: { leading: boolean; trailing: boolean }): LessonScoreRow[] {
  const rows: LessonScoreRow[] = packScoreRows(measureWidths, availableWidth)
  if (interludes.leading) rows.unshift({ startIndex: -1, widths: [availableWidth], interlude: 'leading' })
  if (interludes.trailing) rows.push({ startIndex: -1, widths: [availableWidth], interlude: 'trailing' })
  return rows
}
