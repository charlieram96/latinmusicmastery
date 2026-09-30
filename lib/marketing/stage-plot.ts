/**
 * The salsa-orchestra stage plot on the home page: twelve seats keyed by the
 * course `instrument` value, with the prototype's positions, glyphs, channel
 * labels and one-line notes. Pure data; the component renders it as SVG.
 */
import { INSTRUMENT_ORDER } from './catalog'

export type Glyph = 'timbal' | 'conga' | 'bongo' | 'drums' | 'piano' | 'bass' | 'tres' | 'guitar' | 'violin' | 'horn' | 'mic'

export interface Seat {
  key: string
  x: number
  y: number
  glyph: Glyph
  ch: string
  /** Short label printed under the seat. */
  name: { en: string; es: string }
  note: { en: string; es: string }
}

export const VIEWBOX = { w: 900, h: 620 }
export const APRON_PATH = 'M30 40h840v480q-420 90-840 0z'
/** Seat pad size (centred on the seat's x/y). */
export const PAD = { w: 124, h: 100 }

export const SEATS: Seat[] = [
  { key: 'Timbal', x: 450, y: 130, glyph: 'timbal', ch: 'CH 01–04', name: { en: 'Timbal', es: 'Timbal' }, note: { en: 'Cáscara, abanicos and the bell that drives the mambo.', es: 'Cáscara, abanicos y la campana que empuja el mambo.' } },
  { key: 'Conga', x: 290, y: 130, glyph: 'conga', ch: 'CH 05–07', name: { en: 'Congas', es: 'Congas' }, note: { en: 'The tumbao: slap on two, open tones on four-and.', es: 'El tumbao: slap en el dos, tonos abiertos en el cuatro-y.' } },
  { key: 'Minor Percussion', x: 612, y: 130, glyph: 'bongo', ch: 'CH 08–09', name: { en: 'Minor Perc.', es: 'Perc. menor' }, note: { en: 'Bongó, campana, güiro, maracas. The bongocero takes the bell in the montuno.', es: 'Bongó, campana, güiro, maracas. El bongosero toma la campana en el montuno.' } },
  { key: 'Drums', x: 770, y: 130, glyph: 'drums', ch: 'CH 10–16', name: { en: 'Drums', es: 'Batería' }, note: { en: 'Songo, timba and Latin jazz grooves on the kit.', es: 'Songo, timba y latin jazz en la batería.' } },
  { key: 'Piano', x: 130, y: 300, glyph: 'piano', ch: 'CH 17–18', name: { en: 'Piano', es: 'Piano' }, note: { en: 'Montunos, guajeos and the harmony under the coro.', es: 'Montunos, guajeos y la armonía bajo el coro.' } },
  { key: 'Bass', x: 290, y: 300, glyph: 'bass', ch: 'CH 19', name: { en: 'Bass', es: 'Bajo' }, note: { en: 'The anticipated tumbao that never lands on one.', es: 'El tumbao anticipado que nunca cae en el uno.' } },
  { key: 'Tres', x: 540, y: 300, glyph: 'tres', ch: 'CH 20', name: { en: 'Tres', es: 'Tres' }, note: { en: 'Three doubled courses and the guajeo at the heart of son.', es: 'Tres órdenes dobles y el guajeo en el corazón del son.' } },
  { key: 'Guitar', x: 668, y: 300, glyph: 'guitar', ch: 'CH 21', name: { en: 'Guitar', es: 'Guitarra' }, note: { en: 'Rasgueo, guajira strumming and bolero voicings.', es: 'Rasgueo, guajira y voicings de bolero.' } },
  { key: 'Violin', x: 796, y: 300, glyph: 'violin', ch: 'CH 22', name: { en: 'Violin', es: 'Violín' }, note: { en: 'The charanga string section: danzón and cha-cha-chá.', es: 'La cuerda de la charanga: danzón y cha-cha-chá.' } },
  { key: 'Saxophone', x: 215, y: 450, glyph: 'horn', ch: 'CH 23', name: { en: 'Sax', es: 'Saxo' }, note: { en: 'Mambo lines, moñas and Latin jazz solos.', es: 'Líneas de mambo, moñas y solos de latin jazz.' } },
  { key: 'Trumpet', x: 350, y: 450, glyph: 'horn', ch: 'CH 24', name: { en: 'Trumpet', es: 'Trompeta' }, note: { en: 'Section playing, moñas and the high lead line.', es: 'Sección de metales, moñas y la primera voz aguda.' } },
  { key: 'Voice', x: 520, y: 450, glyph: 'mic', ch: 'CH 25–27', name: { en: 'Voice', es: 'Voz' }, note: { en: 'The sonero sings the pregón and plays the clave.', es: 'El sonero canta el pregón y toca la clave.' } },
]

/** SVG inner markup per glyph, drawn around (0,0); classes `g` (stroke) and `gf` (fill). */
export const SEAT_GLYPHS: Record<Glyph, string> = {
  timbal: '<circle class="g" cx="-18" cy="0" r="16"/><circle class="g" cx="18" cy="2" r="18"/><rect class="gf" x="-5" y="-26" width="10" height="7" rx="2"/><circle class="g" cx="-44" cy="-14" r="9"/>',
  conga: '<circle class="g" cx="-24" cy="4" r="14"/><circle class="g" cx="4" cy="-8" r="15"/><circle class="g" cx="30" cy="6" r="16"/>',
  bongo: '<circle class="g" cx="-10" cy="0" r="11"/><circle class="g" cx="13" cy="0" r="13"/><rect class="gf" x="-28" y="-24" width="12" height="8" rx="2"/><ellipse class="g" cx="30" cy="-18" rx="9" ry="5"/>',
  drums: '<circle class="g" cx="0" cy="8" r="20"/><circle class="g" cx="-26" cy="-12" r="10"/><circle class="g" cx="24" cy="-14" r="11"/><circle class="g" cx="-38" cy="16" r="13" stroke-dasharray="3 3"/><circle class="g" cx="40" cy="12" r="14" stroke-dasharray="3 3"/>',
  piano: '<path class="g" d="M-50 -32h54c24 0 40 15 40 34v0c0 17-11 28-28 28h-66z"/><path class="g" d="M-50 -32v60" stroke-width="5" stroke-dasharray="2 3"/>',
  bass: '<path class="g" d="M-10 22c-12 0-16-10-12-18s0-12 6-16 6-12 16-12 12 8 10 14-6 8-2 14-4 18-18 18z"/><path class="g" d="M4 -22l18 -34"/>',
  tres: '<circle class="g" cx="-6" cy="8" r="17"/><circle class="gf" cx="-6" cy="8" r="4"/><path class="g" d="M8 -2l26 -36"/>',
  guitar: '<path class="g" d="M-8 24c-14 0-20-12-14-22 4-6 0-12 8-16s10-10 18-8 10 10 6 16 2 12-4 20-6 10-14 10z"/><path class="g" d="M8 -12l24 -30"/>',
  violin: '<path class="g" d="M-3 18c-9 0-12-7-9-13s0-8 4-11 4-8 10-8 8 6 6 9-3 6 0 10-2 13-11 13z"/><path class="g" d="M6 -14l14 -22"/><path class="g" d="M-22 -18l44 30"/>',
  horn: '<path class="g" d="M-26 0h30l14 -12v24l-14 -12"/><circle class="g" cx="-14" cy="-8" r="3"/><circle class="g" cx="-4" cy="-8" r="3"/><circle class="g" cx="6" cy="-8" r="3"/>',
  mic: '<circle class="g" cx="0" cy="-6" r="10"/><circle class="gf" cx="0" cy="-6" r="4"/><path class="g" d="M0 4v22M-14 26h28"/>',
}

export const seatByKey = (key: string): Seat | undefined => SEATS.find(s => s.key === key)

type Counted = { key: string; total: number }
const rank = (k: string) => { const i = INSTRUMENT_ORDER.indexOf(k); return i < 0 ? 99 : i }

/** The instrument with the most published courses (ties go to stage order). */
export function defaultSeatKey(instruments: Counted[]): string {
  const live = instruments.filter(i => i.total > 0 && seatByKey(i.key))
  if (!live.length) return SEATS[0].key
  return [...live].sort((a, b) => b.total - a.total || rank(a.key) - rank(b.key))[0].key
}

/** A seat is "soon" when the catalog has no published course for it. */
export function isSoonSeat(key: string, instruments: Counted[]): boolean {
  return !instruments.some(i => i.key === key && i.total > 0)
}
