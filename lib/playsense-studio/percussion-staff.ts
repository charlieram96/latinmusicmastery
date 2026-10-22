import { getPercStrokes } from './perc-strokes'

/** Unpitched teaching notation, authored against the untouched video clock. */
export type PercussionStroke = 'cascara' | 'cascara-low' | 'rim' | 'muted' | 'open' | 'tom'
export type PercussionStaffCue = {
  start: number
  end: number
  bar: number
  section: 'sobao' | 'cascara'
  call?: boolean
  closing?: boolean
  position: { x: number; y: number }
  slots: readonly { at: number; right: PercussionStroke | null; left: PercussionStroke | null }[]
}
/** Official LMM timbal legend, including its open and closed Sobao heads. */
export function teachingStrokeNotation(kind: PercussionStroke, hand: 'right'|'left') {
  const legend = getPercStrokes('perc-timbal')!
  const stroke = legend.find(s => s.id === (kind === 'rim' ? 'rim' : kind === 'cascara-low' ? 'cascara-low' : kind === 'cascara' ? 'cascara' : kind === 'tom' && hand === 'right' ? 'high' : 'low'))!
  const [letter, octave] = stroke.staffLine.split('/')
  const step = Number(octave)*7 + ['c','d','e','f','g','a','b'].indexOf(letter)
  return { staffLine:stroke.staffLine, y:140-(step-30)*5,
    notehead:kind === 'muted' ? 'circle-x' : kind === 'open' ? 'slashed-open' : stroke.notehead ?? 'normal' }
}
export function teachingNoteDuration(cue: PercussionStaffCue, index:number, hand:'right'|'left') {
  if (hand === 'left') return .5
  if (cue.closing) return 1
  if (cue.section === 'cascara' || cue.slots[index]?.[hand] === 'rim') return .5
  // Ritmo Basico de la Cascara en el Son.mxl, voice 1, bars 1–2.
  // Bar 2 deliberately retains the eighth rest on beat 3.
  const quarter = index === 0 || (cue.bar === 1 && index === 2) || index === 5
  return quarter && !cue.slots[index + 1]?.right ? 1 : .5
}
export function percussionStaffAt(cues: readonly PercussionStaffCue[], time: number) {
  const cue = cues.find(c => time >= c.start && time < c.end)
  if (!cue) return null
  const slot = cue.slots.findIndex((hit, i) => time >= hit.at && time < (cue.slots[i + 1]?.at ?? cue.end))
  return { cue, slot }
}
