/** Spoken numbers in the audio-corrected upload, in absolute media seconds.
 * Authored from local word timestamps; no free-running beat generator.
 * A three-count pickup intentionally has no invented fourth number.
 */
export type SpokenCount = { start: number; end: number; beats: readonly { at: number; number: 1 | 2 | 3 | 4 }[] }
const phrase = (times: number[], numbers: (1 | 2 | 3 | 4)[] = [1, 2, 3, 4]): SpokenCount => ({
  start: times[0], end: times[times.length - 1] + .48,
  beats: times.map((at, i) => ({ at, number: numbers[i] })),
})
export const ritmoSpokenCounts: readonly SpokenCount[] = [
  phrase([67.56, 68.28, 68.76], [1, 2, 3]),
  phrase([137.92, 138.26, 139.16, 139.66]),
  phrase([157.05, 157.66, 158.06, 158.3]),
  phrase([174.55, 175.28, 175.84, 176.24]),
  phrase([226.1, 226.64, 227.56, 227.84]),
  phrase([230.9, 231.46, 232.32, 232.74]),
  phrase([237.12, 237.4], [3, 4]),
  phrase([240.5, 241.06, 241.76, 242.36]),
  phrase([247.04, 247.58, 248.12, 248.76]),
  phrase([251.98, 252.58, 253.38, 253.92]),
  phrase([256.7, 257.2, 258.2, 258.48]),
  phrase([261.48, 262.02, 262.94, 263.2]),
  phrase([336.5], [3]),
  phrase([372.58, 373, 373.28, 373.62]),
]
export function spokenCountAt(counts: readonly SpokenCount[], time: number) {
  const phrase = counts.find(count => time >= count.start && time < count.end)
  if (!phrase) return null
  const beat = [...phrase.beats].reverse().find(beat => beat.at <= time)!
  return { phrase, beat }
}
