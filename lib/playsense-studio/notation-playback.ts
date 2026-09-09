/** Geometry and clock helpers shared by notation playback and its regression tests. */
export interface ScoreAnchor { ms: number; x: number; system: number }

export function scoreCursorAt(ms: number, anchors: readonly ScoreAnchor[], endMs: number, rowEnds: readonly number[]): { x: number; system: number } {
  if (!anchors.length) return { x: 0, system: 0 }
  const time = Math.max(0, Math.min(ms, endMs))
  if (time <= anchors[0].ms) return { x: anchors[0].x, system: anchors[0].system }
  let lo = 0, hi = anchors.length
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1
    if (anchors[mid].ms <= time) lo = mid
    else hi = mid
  }
  const a = anchors[lo], b = anchors[lo + 1]
  const end = b?.ms ?? endMs
  const endX = b && b.system === a.system ? b.x : (rowEnds[a.system] ?? a.x)
  const fraction = Math.max(0, Math.min(1, (time - a.ms) / Math.max(1, end - a.ms)))
  return { x: a.x + (endX - a.x) * fraction, system: a.system }
}

/** Keep the opening clef and final bar visible; short phrases never drift away. */
export function scoreScrollOffset(positionPx: number, viewportPx: number, contentPx: number, anchorFraction = .26): number {
  const offset = Math.max(0, Math.min(positionPx - viewportPx * anchorFraction, Math.max(0, contentPx - viewportPx)))
  return offset === 0 ? 0 : -offset
}

export interface ScoreReadingMeasure { x: number; width: number; startMs: number; endMs: number }
export interface ScoreReadingStop { ms: number; offset: number }
export interface ScoreReadingRow { y: number; startMs: number; endMs: number }
type ReadingAnchor = Pick<ScoreAnchor, 'ms' | 'x'>

/**
 * Advance through a row over its musical duration, not after it leaves the
 * viewport. Adjacent rows share the same position at their boundary, so a
 * new downbeat cannot trigger a page jump. All coordinates are rendered pixels.
 */
export function scoreVerticalOffset(ms: number, rows: readonly ScoreReadingRow[], viewportPx: number, contentPx: number): number {
  if (!rows.length || viewportPx <= 0 || contentPx <= viewportPx) return 0
  let lo = 0, hi = rows.length
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1
    if (rows[mid].startMs <= ms) lo = mid
    else hi = mid
  }
  const row = rows[lo], next = rows[lo + 1]
  const pitch = next ? next.y - row.y : row.y - (rows[lo - 1]?.y ?? row.y)
  const fraction = Math.max(0, Math.min(1, (ms - row.startMs) / Math.max(1, row.endMs - row.startMs)))
  const position = row.y + (next ? next.y - row.y : 0) * fraction
  // Read in the upper part of the pane, leaving the following rows in view.
  const readingLine = Math.min(viewportPx * .38, pitch + 24)
  return Math.max(0, Math.min(position - readingLine, contentPx - viewportPx))
}

/**
 * Hold a phrase still while it is read. Prefer turns at barlines; an oversized
 * bar turns on a visible beat (or note if a single beat is wider than the pane).
 * All coordinates are rendered pixels. Stops are planned once, never chased
 * frame by frame, so a wide measure cannot suddenly accelerate the score.
 */
export function scoreReadingStops(
  measures: readonly ScoreReadingMeasure[],
  beats: readonly ReadingAnchor[],
  notes: readonly ReadingAnchor[],
  viewportPx: number,
  contentPx: number,
): ScoreReadingStop[] {
  const stops: ScoreReadingStop[] = [{ ms: 0, offset: 0 }]
  const padding = 16
  const preview = 40
  if (viewportPx <= padding * 2 || contentPx <= viewportPx) return stops
  let left = 0
  const turn = (ms: number, x: number) => {
    const offset = scoreScrollOffset(x - padding, viewportPx, contentPx, 0)
    if (-offset <= left) return
    left = -offset
    if (stops[stops.length - 1].ms === ms) stops[stops.length - 1] = { ms, offset }
    else stops.push({ ms, offset })
  }
  for (const measure of measures) {
    const right = measure.x + measure.width
    if (right <= left + viewportPx - padding) continue
    // Keep all the notes of a bar together whenever that bar fits in one view.
    if (measure.x > left + padding) turn(measure.startMs, measure.x)
    if (right <= left + viewportPx - padding) continue

    let startMs = measure.startMs
    const barBeats = beats.filter(a => a.ms > startMs && a.ms < measure.endMs)
    const barNotes = notes.filter(a => a.ms > startMs && a.ms < measure.endMs)
    while (right > left + viewportPx - padding) {
      const limit = left + viewportPx - preview
      const visible = (a: ReadingAnchor) => a.ms > startMs && a.x > left + padding && a.x <= limit
      // Leave the next beat visible before turning. If the beat is unusually
      // wide, use a note onset rather than panning continuously through it.
      const beat = barBeats.filter(visible).at(-1)
      const anchor = beat ?? barNotes.filter(visible).at(-1)
      if (!anchor) break
      const previousLeft = left
      turn(anchor.ms, anchor.x)
      startMs = anchor.ms
      if (left === previousLeft) break
    }
  }
  return stops
}

/** Time-based lookup also handles seeking, repeat jumps, and the final hold. */
export function scoreReadingOffset(ms: number, stops: readonly ScoreReadingStop[]): number {
  let lo = 0, hi = stops.length
  while (lo + 1 < hi) {
    const mid = (lo + hi) >>> 1
    if (stops[mid].ms <= ms) lo = mid
    else hi = mid
  }
  return stops[lo]?.offset ?? 0
}

/** The exercise clock includes all repetitions; the score shows one pass. */
export function exerciseScoreTime(elapsedSeconds: number, durationSeconds: number, loops: number, scoreDurationMs: number): number {
  if (durationSeconds <= 0 || scoreDurationMs <= 0) return 0
  if (elapsedSeconds >= durationSeconds) return scoreDurationMs
  const pass = Math.max(0, elapsedSeconds) / durationSeconds * Math.max(1, loops)
  return (pass - Math.floor(pass)) * scoreDurationMs
}
