import type { LessonPresentation, PresentationCue } from './lesson-presentation'
import { variacionesStaff } from './variaciones-staff'
import { variacionesHandCoordination } from './variaciones-hand-coordination'
import { variacionesSpokenCounts } from './variaciones-spoken-counts'

export const VARIACIONES_SOURCE_PATH = '/local-course-assets/codex-variaciones/preview.mp4'
export const VARIACIONES_SOURCE_DURATION = 405.037967
/** Matching narration throughout the two files: the untouched upload is 0.2 s earlier. */
export const variacionesSourceTime = (reference: number) => Math.max(0, reference - .2)
const banner = (id: string, start: number, end: number, es: string, en: string, titleEs = 'VARIACIÓN', titleEn = 'VARIATION'): PresentationCue => ({
  id, kind: 'title', start, end, title: { es: titleEs, en: titleEn }, label: { es, en },
})
/** Reconstructed from the original lower thirds, on the new upload's media clock. */
export const variacionesPresentation: LessonPresentation = {
  handCoordination: variacionesHandCoordination,
  percussionStaff: variacionesStaff,
  spokenCounts: variacionesSpokenCounts,
  id: 'codex-variaciones-v1', instructor: 'Patricio «el chino» Díaz',
  poster: '/local-course-assets/patricio-lesson-opening.svg',
  cues: [
    { id: 'variaciones-instructor', kind: 'instructor', start: 2.4, end: 8.2,
      title: { es: 'PATRICIO "el chino" DIAZ', en: 'PATRICIO "el chino" DIAZ' },
      nameParts: ['PATRICIO', '"el chino"', 'DIAZ'], label: { es: 'INSTRUCTOR MASTER', en: 'MASTER INSTRUCTOR' } },
    banner('sobao-introduction', 11.4, 17.3, 'CÁSCARA CON SOBAO', 'CÁSCARA WITH SOBAO'),
    banner('sobao-complete', 45.3, 51.1, 'CÁSCARA CON SOBAO COMPLETO', 'CÁSCARA WITH COMPLETE SOBAO'),
    banner('sobao-simple-slow', 99.2, 107.2, 'SOBAO - SENCILLO - LENTO', 'SOBAO — SIMPLE — SLOW'),
    banner('sobao-simple-slow-repeat', 119.6, 127.4, 'SOBAO - SENCILLO - LENTO', 'SOBAO — SIMPLE — SLOW'),
    banner('sobao-first-measure', 175.3, 182.4, 'SOBAO 1ER COMPÁS', 'SOBAO — 1ST MEASURE'),
    banner('sobao-second-measure', 190.4, 198.4, 'SOBAO 2DO COMPÁS', 'SOBAO — 2ND MEASURE'),
    banner('sobao-two-measures', 223.4, 229.2, 'CÁSCARA CON SOBAO DOS COMPASES', 'CÁSCARA WITH SOBAO — TWO MEASURES'),
    banner('sobao-moderate', 250.4, 256.3, 'SOBAO · TIEMPO MODERADO', 'SOBAO — MODERATE TEMPO'),
    banner('alternating-fill', 280.2, 287.2, 'CÁSCARA CON SOBAO - RELLENO', 'CÁSCARA WITH SOBAO — FILL', 'ALTERNANDO', 'ALTERNATING'),
  ].map(cue => ({ ...cue, start: cue.kind === 'instructor' ? .6 : variacionesSourceTime(cue.start), end: variacionesSourceTime(cue.end) })) as PresentationCue[],
}
