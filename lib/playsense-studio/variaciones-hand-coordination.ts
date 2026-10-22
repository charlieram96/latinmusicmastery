import type { HandCoordinationCue } from './hand-coordination'

// Local teaching draft for codex-variaciones/preview.mp4 only. Phrase boundaries
// checked against narration, waveform attacks and the close-up camera. No audio edits.
const right = [[0, 2, 4, 5, 7], [0, 2, 3, 5, 7]]
const fullLeft = [[1, 3, 6], [1, 4, 6]]
const position = { x: 12, y: 12 }
function bars(anchors: number[], variant: 'simple' | 'complete', firstBar = 0, omitFinalRight = false): HandCoordinationCue[] {
  return anchors.slice(0, -1).map((start, index) => {
    const bar = (index + firstBar) % 2
    const end = anchors[index + 1]
    return { start, end, bar: bar + 1, variant, position,
      slots: Array.from({ length: 8 }, (_, slot) => ({
        at: start + (end - start) * slot / 8,
        right: right[bar].includes(slot) && !(omitFinalRight && index === anchors.length - 2 && slot === 7),
        // Sobao: damped strokes precede the open tone on beat 4.
        leftStroke: (variant === 'complete' ? fullLeft[bar] : [2, 6]).includes(slot)
          ? (slot === 6 ? 'open' as const : 'muted' as const) : undefined,
        left: (variant === 'complete' ? fullLeft[bar] : [2, 6]).includes(slot),
      })) }
  })
}
// Exact audible attacks for the added slow practice. Empty subdivisions are
// interpolated only to move the cursor; every lit square uses a measured attack.
function measuredSimple(bar: number, attacks: number[], end: number, start = attacks[0], omitFinalRight = false): HandCoordinationCue {
  const occupied = bar === 1 ? [0, 2, 4, 5, 6, 7] : [0, 2, 3, 5, 6, 7]
  const times = Array<number>(8).fill(0)
  occupied.forEach((slot, index) => { times[slot] = attacks[index] })
  for (let slot = 0; slot < 8; slot++) {
    if (occupied.includes(slot)) continue
    times[slot] = (times[slot - 1] + times[slot + 1]) / 2
  }
  return { start, end, bar, variant: 'simple', position,
    slots: times.map((at, slot) => ({ at, right: right[bar - 1].includes(slot) && !(omitFinalRight && slot === 7), left: slot === 2 || slot === 6,
      leftStroke: slot === 2 ? 'muted' : slot === 6 ? 'open' : undefined })) }
}
const slowPractice = [
  measuredSimple(1, [150.12,150.68,151.28,151.59,151.88,152.19],152.50,150),
  measuredSimple(2, [152.50,153.10,153.41,153.96,154.28,154.59],154.90),
  measuredSimple(1, [154.90,155.51,156.09,156.39,156.69,156.95],157.24),
  measuredSimple(2, [157.24,157.86,158.18,158.78,159.09,159.39],159.69),
  measuredSimple(1, [159.69,160.30,160.91,161.20,161.50,161.77],162.09),
  measuredSimple(2, [162.09,162.69,163.01,163.59,163.90,164.17],164.48),
  measuredSimple(1, [164.48,165.08,165.68,165.98,166.25,166.54],166.88),
  measuredSimple(2, [166.88,167.47,167.78,168.36,168.65,168.96],169,166.88,true),
]
// Demonstration of the opening of bar 2: right, together, right. The old
// provisional first event was a preparation movement ~0.5 s before the sound.
const secondBarGestures: HandCoordinationCue[] = [
  [191.99,192.52,192.83], [194.35,194.93,195.24],
  [196.75,197.33,197.64], [199.17,199.73,200.05],
].map(times => ({ start: times[0], end: times[2] + .35, bar: 2, variant: 'simple', isolated: true, position,
  slots: times.map((at, index) => ({ at, right: true, left: index === 1, leftStroke: index === 1 ? 'muted' : undefined })) }))
// Both isolated full-bar examples stop on the open left tone. The following
// timestamp is an empty subdivision, not a played right-hand attack.
const secondBarPractice = [
  measuredSimple(2, [208.73,209.31,209.66,210.22,210.53,210.92],211.3,208,true),
  measuredSimple(2, [213.55,214.13,214.57,215.03,215.34,215.67],215.9,213.55,true),
  measuredSimple(2,[218.35,218.99,219.24,219.82,220.11,220.42],220.60,218.35,true),
]
// Instructor-confirmed: only the opening demonstration is complete Sobao.
// The moderate demonstration is simple too; use each recorded attack, including
// the slightly delayed open tones, rather than an evenly spaced template.
const moderatePractice: HandCoordinationCue[] = [
  measuredSimple(1,[252.68,253.17,253.67,253.91,254.24,254.38],254.63,252),
  measuredSimple(2,[254.63,255.12,255.40,255.86,256.13,256.38],256.63),
  measuredSimple(1,[256.63,257.14,257.64,257.89,258.23,258.38],258.63),
  measuredSimple(2,[258.63,259.13,259.39,259.86,260.12,260.35],260.62),
  measuredSimple(1,[260.62,261.10,261.63,261.88,262.14,262.36],262.63),
  measuredSimple(2,[262.63,263.13,263.38,263.85,264.18,264.33],264.60),
  measuredSimple(1,[264.60,265.10,265.62,265.88,266.14,266.38],266.64),
  measuredSimple(2,[266.64,267.12,267.39,267.88,268.14,268.37],268.63),
  measuredSimple(1,[268.63,269.14,269.63,269.88,270.13,270.37],270.62),
  measuredSimple(2,[270.62,271.12,271.39,271.85,272.12,272.34],272.61),
  measuredSimple(1,[272.61,273.11,273.63,273.89,274.15,274.37],274.64),
  // The last round includes its second bar; it ends after the right-hand pickup.
  { ...measuredSimple(2,[274.64,275.14,275.40,275.86,276.14,276.39],276.64),
    slots: [
      {at:274.64,right:true,left:false}, {at:274.89,right:false,left:false},
      {at:275.14,right:true,left:true,leftStroke:'muted'}, {at:275.40,right:true,left:false},
      {at:275.63,right:false,left:false}, {at:275.86,right:true,left:false},
      {at:276.14,right:false,left:false}, {at:276.39,right:false,left:false},
    ] },
]
// Quiet third-beat damped taps are real variations, not a different global pattern.
for (const at of [259.64,263.62,267.65]) {
  const cue = moderatePractice.find(c => at >= c.start && at < c.end)!
  cue.slots = cue.slots.map((note, slot) => slot === 4
    ? { ...note, at, left:true, leftStroke:'muted' } : note)
}
// First demonstration ends on the left-hand open tone (~71.57 s): no final right-hand stroke.
// Each bar has its own anchor, so the instructor's natural tempo is retained.
export const variacionesHandCoordination: readonly HandCoordinationCue[] = [
  ...bars([48.14,50.56,52.96,55.39,57.79,60.19,62.59,65.00,67.40,69.80,72.15], 'complete', 0, true),
  ...bars([98.78,100.85,102.90,104.97,106.97,108.98,111.0], 'simple', 0, true),
  ...slowPractice,
  ...bars([177.47,179.83], 'simple', 0, true),
  ...secondBarGestures,
  ...secondBarPractice,
  ...bars([225.52,227.95,230.45,232.75,235.10,237.53,239.91,242.31,244.71,247.12,249.50], 'simple', 0, true),
  ...moderatePractice,
]
