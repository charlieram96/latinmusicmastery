/** A segment stays selected at its end; only explicit navigation changes it. */
export function segmentBounds(segment: number, seconds: number) {
  if (segment < 0) return { start: 0, end: 6 }
  const start = 6 + segment * seconds
  return { start, end: segment === 5 ? start : start + seconds }
}
export function tickSegment(time: number, segment: number, seconds: number, loop: boolean) {
  const { start, end } = segmentBounds(segment, seconds)
  if (start === end) return { time: end, running: false }
  const next = Math.round((time + .1) * 10) / 10
  if (next >= end) return loop ? { time: start, running: true } : { time: end, running: false }
  return { time: next, running: true }
}
