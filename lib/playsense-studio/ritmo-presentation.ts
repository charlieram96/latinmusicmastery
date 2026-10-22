import { ritmoSpokenCounts } from './ritmo-spoken-counts'
import type { LessonPresentation, PresentationCue } from './lesson-presentation'

export const RITMO_SOURCE_FILE = 'c48701c9-d7c8-462f-b78c-4b0c480cc2bc-1791663839661.mp4'
export const RITMO_SOURCE_PATH = '/local-course-assets/codex-ritmo/codex-ritmo-audio-corrected.mp4'
export const RITMO_SOURCE_DURATION = 442.208433
/** Measured matching narration anchors; the uploaded media is never edited. */
export const ritmoSourceTime = (seconds: number) => Math.max(0, seconds < 166.5 ? seconds - 10.3102 : seconds + 2.4024)
export const RITMO_REFERENCE_DURATION = 440.3399
const banner = (id: string, start: number, end: number, es: string, en: string, titleEs = 'RITMO BÁSICO', titleEn = 'BASIC RHYTHM', plain = false): PresentationCue => ({
  id, kind: 'title', start, end, title: { es: titleEs, en: titleEn }, label: { es, en }, plain,
})
/** Reference cues are translated onto the untouched upload clock. */
export const ritmoPresentation: LessonPresentation = {
  spokenCounts: ritmoSpokenCounts,
  id: 'codex-ritmo-basico-v1', instructor: 'Patricio «el chino» Díaz',
  poster: '/local-course-assets/patricio-lesson-opening.svg',
  cues: [
    { id: 'ritmo-instructor', kind: 'instructor', start: 13.4, end: 18.8,
      title: { es: 'PATRICIO "el chino" DIAZ', en: 'PATRICIO "el chino" DIAZ' }, nameParts: ['PATRICIO', '"el chino"', 'DIAZ'], label: { es: 'INSTRUCTOR MASTER', en: 'MASTER INSTRUCTOR' } },
    banner('fundamentals', 20.8, 25.5, 'DEL TIMBAL EN EL SON', 'OF TIMBALES IN SON', 'FUNDAMENTOS', 'FUNDAMENTALS'),
    banner('cascara-introduction', 67.5, 76, '"LA CÁSCARA"', '“CÁSCARA”'),
    { id: 'heritage', kind: 'heritage', start: 123, end: 132.5, title: { es: 'HERENCIA RÍTMICA', en: 'RHYTHMIC HERITAGE' }, label: { es: 'EN EL RITMO DE LA CÁSCARA', en: 'IN THE CÁSCARA RHYTHM' } },
    { id: 'bamboo', kind: 'instrument', start: 142.8, end: 149, title: { es: 'BAMBOO KATA (TRADICIONAL)', en: 'BAMBOO KATA (TRADITIONAL)' }, label: { es: 'Versión en bambú, muy utilizada en tradiciones africanas. Similar al Cata moderno.', en: 'A bamboo version widely used in African traditions. Similar to the modern Cata.' } },
    banner('cascara-pattern', 147.2, 155.5, '"LA CÁSCARA"', '“CÁSCARA”'),
    banner('left-fill', 167.6, 174.5, '"LA CÁSCARA" - Relleno Mano Izquierda.', '“CÁSCARA” — Left-hand fill.'),
    banner('first-measure-intro', 195, 200.5, '"LA CÁSCARA" - 1er Compás', '“CÁSCARA” — 1st measure'),
    banner('subdivision', 204, 225, '"LA CÁSCARA" - 1er Compás', '“CÁSCARA” — 1st measure', 'CUENTA SUBDIVIDIDA', 'SUBDIVIDED COUNT', true),
    banner('first-measure', 225.2, 240.5, '"LA CÁSCARA" - 1er Compás', '“CÁSCARA” — 1st measure'),
    banner('second-measure', 242, 258.7, '"LA CÁSCARA" - 2do Compás', '“CÁSCARA” — 2nd measure'),
    banner('two-measures', 260, 275.5, '"LA CÁSCARA" - Dos Compases', '“CÁSCARA” — Two measures'),
    banner('accents', 284.5, 294, '"ACENTOS EN LA CÁSCARA"', '“ACCENTS IN CÁSCARA”'),
    { id: 'accent-symbol', kind: 'teaching', start: 295.2, end: 299.2, title: { es: '>', en: '>' }, label: { es: 'ACENTO', en: 'ACCENT' }, detail: { es: 'Destaca el golpe sin acelerar el pulso', en: 'Emphasize the stroke without rushing the pulse' } },
  ].map(cue => ({ ...cue, start: cue.kind === 'instructor' ? .6 : ritmoSourceTime(cue.start), end: ritmoSourceTime(cue.end) })) as PresentationCue[],
}
