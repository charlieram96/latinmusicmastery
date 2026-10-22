/** Authored against the original media clock, never a free-running BPM timer. */
export type HandCoordinationCue = {
  start: number
  end: number
  bar: number
  variant?: 'simple' | 'complete'
  isolated?: boolean
  /** Position within a 1280 × 720 picture, verified against this camera shot. */
  position: { x: number; y: number }
  slots: readonly { at: number; right: boolean; left: boolean; leftStroke?: 'muted' | 'open' }[]
}

export function handCoordinationAt(cues: readonly HandCoordinationCue[], time: number) {
  const cue = cues.find(cue => time >= cue.start && time < cue.end)
  if (!cue) return null
  const slot = cue.slots.findIndex((hit, index) => time >= hit.at && time < (cue.slots[index + 1]?.at ?? cue.end))
  return { cue, slot }
}
