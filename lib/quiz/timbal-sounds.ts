import type { PieceHitMask } from './piece-hit-test'

/** Left-to-right home row; S/K are the open low/high timbales. */
export const TIMBAL_KEYS = [
  { key: 'A', kind: 'low', sound: 'low-shell', en: 'Low Timbale · shell', es: 'Timbal grave · cáscara' },
  { key: 'S', kind: 'low', sound: 'low-head', en: 'Low Timbale · open', es: 'Timbal grave · abierto' },
  { key: 'D', kind: 'contra', sound: 'contra', en: 'Contra Campana', es: 'Contra campana' },
  { key: 'F', kind: 'hand-bell', sound: 'hand-bell', en: 'Hand Bell', es: 'Campana de mano' },
  { key: 'G', kind: 'cha', sound: 'cha', en: 'Bell Cha', es: 'Campana cha' },
  { key: 'H', kind: 'jamblock', sound: 'jamblock', en: 'Jamblock', es: 'Jamblock' },
  { key: 'J', kind: 'cymbal', sound: 'cymbal', en: 'Cymbal', es: 'Platillo' },
  { key: 'K', kind: 'high', sound: 'high-head', en: 'High Timbale · open', es: 'Timbal agudo · abierto' },
  { key: 'L', kind: 'high', sound: 'high-shell', en: 'High Timbale · shell', es: 'Timbal agudo · cáscara' },
] as const

export function timbalSoundKind(label: string): string | null {
  const name = label.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[_-]/g, ' ')
  if (/high timbal|timbal.*(agudo|macho)/.test(name)) return 'high'
  if (/low timbal|timbal.*(grave|hembra)/.test(name)) return 'low'
  if (/contra.*campana/.test(name)) return 'contra'
  if (/hand\s*bell|campana.*(bongo|mano)/.test(name)) return 'hand-bell'
  if (/bell cha|campana.*cha/.test(name)) return 'cha'
  if (/jam\s*block/.test(name)) return 'jamblock'
  if (/cymbal|platillo/.test(name)) return 'cymbal'
  return null
}

/** Coordinates relative to the visible sprite, ignoring transparent margins. */
export function timbalSoundUrl(kind: string, x: number, y: number, mask?: PieceHitMask) {
  if (kind === 'high' || kind === 'low') {
    if (!mask) return null // Do not guess a head/shell hit before the image is measured.
    let left=mask.width, right=-1, top=mask.height, bottom=-1
    for(let row=0;row<mask.height;row++) for(let col=0;col<mask.width;col++) {
      if(mask.alpha[row*mask.width+col]<24) continue
      left=Math.min(left,col);right=Math.max(right,col);top=Math.min(top,row);bottom=Math.max(bottom,row)
    }
    if(right<0) return null
    const u=(x*mask.width-left)/(right-left+1), v=(y*mask.height-top)/(bottom-top+1)
    // The photographed head is an ellipse at the top of each upright timbale.
    const head=((u-.5)/.48)**2+((v-.19)/.19)**2<=1
    return `/audio/quiz-timbal/${kind}-${head?'head':'shell'}.wav`
  }
  return `/audio/quiz-timbal/${kind}.wav`
}
