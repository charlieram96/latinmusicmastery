import {publishedContentEnabled} from '@/lib/release/content'
import type { PercussionStaffCue } from './percussion-staff'
import type { HandCoordinationCue } from './hand-coordination'
import { CASCARA_PASO_FILE, cascaraPasoPresentation, type VocalRhythmPhrase } from './cascara-paso-presentation'
import type { SpokenCount } from './ritmo-spoken-counts'
import { ritmoPresentation, RITMO_SOURCE_PATH } from './ritmo-presentation'
import { variacionesPresentation, VARIACIONES_SOURCE_PATH } from './variaciones-presentation'
/** Local authored presentation. Times belong to this exact edit, not the reference cut. */
export type PresentationText = { es: string; en: string }
export type PresentationCue = {
  id: string
  kind: 'instructor' | 'title' | 'archive' | 'timeline' | 'genres' | 'completion' | 'heritage' | 'instrument' | 'teaching' | 'son-influence' | 'son-oriente'
  start: number
  end: number
  label: PresentationText
  title: PresentationText
  /** Optional colored name segments for the reusable reference lower third. */
  plain?: boolean
  nameParts?: readonly [string, string, string]
  detail?: PresentationText
  items?: { text: PresentationText; at: number }[]
}
export type LessonPresentation = {
  id: string
  instructor: string
  spokenCounts?: readonly SpokenCount[]
  handCoordination?: readonly HandCoordinationCue[]
  percussionStaff?: readonly PercussionStaffCue[]
  vocalRhythms?: readonly VocalRhythmPhrase[]
  poster?: string
  cues: readonly PresentationCue[]
}
// Same opening and authored slide cuts; only the ending was replaced.
export const TIMBAL_INTRO_REVISED_FILE = 'd97c387a-fc08-4a7f-8057-a323fd667592-1792263864951.m4v'
export const codexIntroPresentation: LessonPresentation = {
  id: 'codex-intro-v1',
  instructor: 'Patricio «el chino» Díaz',
  poster: '/local-course-assets/patricio-lesson-opening.svg',
  cues: [
    { id: 'instructor', kind: 'instructor', start: .6, end: 7.2,
      label: { es: 'INSTRUCTOR MASTER', en: 'MASTER INSTRUCTOR' },
      title: { es: 'PATRICIO "el chino" DIAZ', en: 'PATRICIO "el chino" DIAZ' },
      nameParts: ['PATRICIO', '"el chino"', 'DIAZ'] },
    { id: 'lesson', kind: 'title', start: 8.2, end: 13.3,
      label: { es: 'A TOCAR SON EN EL TIMBAL', en: 'TO PLAY SON ON TIMBALES' },
      title: { es: 'APRENDIENDO', en: 'LEARNING' } },
    { id: 'son-influence-map', kind: 'son-influence', start: 898 * 1001 / 30000, end: 1166 * 1001 / 30000,
      title: { es: 'La influencia del son', en: 'The influence of son' },
      label: { es: 'De Cuba para el mundo', en: 'From Cuba to the world' } },
    { id: 'son-oriente-map', kind: 'son-oriente', start: 1245 * 1001 / 30000, end: 1547 * 1001 / 30000,
      title: { es: 'Región oriental de Cuba', en: 'Eastern region of Cuba' },
      label: { es: 'Origen del son', en: 'Origins of son' } },
    // Illustrated maps and the Sexteto Habanero collage are already in the source.
    // These reference overlays use the narration alignment (reference minus 11.411s).
    { id: 'decades', kind: 'timeline', start: 81.6, end: 89.2,
      label: { es: '1920s–1930s', en: '1920s–1930s' },
      title: { es: '1920s-1930s', en: '1920s-1930s' } },
    { id: 'influence', kind: 'genres', start: 99.1, end: 107.2,
      label: { es: 'El Son', en: 'Son' },
      title: { es: 'El Son', en: 'Son' },
      items: [
        { text: { es: 'MAMBO', en: 'MAMBO' }, at: 101.5 },
        { text: { es: 'CHA CHA CHA', en: 'CHA CHA CHA' }, at: 103 },
        { text: { es: 'LATIN JAZZ', en: 'LATIN JAZZ' }, at: 104 },
      ] },
  ],
}

/** Exact asset matching keeps the approved presentation scoped to its source video. */
export function lessonPresentationFor(src: string, local = process.env.NODE_ENV === 'development' || publishedContentEnabled()): LessonPresentation | null {
  if (!local) return null
  try {
    const path = new URL(src, 'http://localhost').pathname
    if (path.split('/').pop() === CASCARA_PASO_FILE) return cascaraPasoPresentation
    if (path === RITMO_SOURCE_PATH) return ritmoPresentation
    if (path === VARIACIONES_SOURCE_PATH) return variacionesPresentation
    return path.split('/').pop() === TIMBAL_INTRO_REVISED_FILE ? codexIntroPresentation : null
  } catch { return null }
}
// Browsers expose decoded timestamps at microsecond precision. Compare both sides
// at that precision so a rounded 38.905533 frame is the 1166/29.97 cut.
function cueContainsTime(cue: PresentationCue, seconds: number) {
  const micros = Math.round(seconds * 1e6)
  return micros >= Math.round(cue.start * 1e6) && micros < Math.round(cue.end * 1e6)
}
export function presentationCueAt(presentation: LessonPresentation, seconds: number) {
  return presentation.cues.find(cue => cueContainsTime(cue, seconds)) ?? null
}
export function presentationProgress(seconds: number, start: number, duration = .65) {
  return Math.max(0, Math.min(1, (seconds - start) / duration))
}

export function presentationCuesAt(presentation: LessonPresentation, seconds: number) {
  return presentation.cues.filter(cue => cueContainsTime(cue, seconds))
}
