import { publishedContentEnabled } from '@/lib/release/content'
import { applyLocalModulePresentation, separateTimbalWelcome } from './local-module-presentation'
import { CASCARA_RIGHT_HAND_ITEM, withWatchIntro } from '@/lib/playsense-studio/watch-intro-template'
/** Local-only replacement. Supabase retains both original records as a backup. */
import { headers } from 'next/headers'
import { RITMO_SOURCE_PATH, RITMO_SOURCE_DURATION } from '@/lib/playsense-studio/ritmo-presentation'
import { VARIACIONES_SOURCE_PATH, VARIACIONES_SOURCE_DURATION } from '@/lib/playsense-studio/variaciones-presentation'

export const TIMBAL_VARIACIONES_CLASS = '2f9d9d9d-78fc-4a8f-9f9a-8f7f7c0ee3fe'
export const TIMBAL_VARIACIONES_ORIGINAL = '9a8d288b-b38a-4608-ad2a-1c8b298d6f78'
export const TIMBAL_VARIACIONES_SOURCE = 'c5c5d036-8297-4fc5-9180-b9d25fa3f121'

export const TIMBAL_INTRO_CLASS = 'aacdccc9-2214-4c2c-b8b4-b08f37939259'
export const TIMBAL_INTRO_ORIGINAL = 'd97c387a-fc08-4a7f-8057-a323fd667592'
export const TIMBAL_RITMO_CLASS = 'd6c3b163-7107-4ed8-8072-7ceee93d32e5'
export const TIMBAL_RITMO_ORIGINAL = 'b987150e-8b66-45cb-9579-c3f38495736e'
export const TIMBAL_RITMO_SOURCE = 'c48701c9-d7c8-462f-b78c-4b0c480cc2bc'
export const TIMBAL_RITMO_PREVIOUS_SOURCE = 'c40a1fcf-818f-4f35-815b-a8dd53ebe29b'
export const TIMBAL_INTRO_SOURCE = 'eb756201-e82e-4c37-a3c1-9d6e3dd975a4'

export async function usesLocalTimbalIntro() {
  if (publishedContentEnabled()) return true
  if (process.env.NODE_ENV !== 'development') return false
  const host = (await headers()).get('host')?.split(':')[0]
  return host === 'localhost' || host === '127.0.0.1'
}

type Item = { id: string; [key: string]: unknown }
/** Keep the original identity, titles, notes, order and completion relationships. */
export function replaceTimbalIntroItems<T extends Item>(items: T[]): T[] {
  if (items.some(item => item.id === CASCARA_RIGHT_HAND_ITEM)) items = items.map(withWatchIntro)
  const variations = items.find(item => item.id === TIMBAL_VARIACIONES_SOURCE)
  if (variations?.video_url && items.some(item => item.id === TIMBAL_VARIACIONES_ORIGINAL)) {
    return items.filter(item => item.id !== TIMBAL_VARIACIONES_SOURCE).map(item => item.id === TIMBAL_VARIACIONES_ORIGINAL ? {
      ...item, video_url: VARIACIONES_SOURCE_PATH, video_duration_seconds: VARIACIONES_SOURCE_DURATION,
      video_trim_in_seconds: 0, video_trim_out_seconds: null,
      subtitles: Array.isArray(item.subtitles) && item.subtitles.length ? item.subtitles : [
        { lang: 'es', label: 'Español', src: '/local-course-assets/codex-variaciones/es.vtt' },
        { lang: 'en', label: 'English', src: '/local-course-assets/codex-variaciones/en.vtt' },
      ],
    } : item)
  }
  const ritmoSource = items.find(item => item.id === TIMBAL_RITMO_SOURCE)
  if (ritmoSource && items.some(item => item.id === TIMBAL_RITMO_ORIGINAL)) {
    // Preserve the uploaded file exactly; synchronization is adapted on read.
    return items.filter(item => ![TIMBAL_RITMO_SOURCE, TIMBAL_RITMO_PREVIOUS_SOURCE].includes(item.id)).map(item => item.id === TIMBAL_RITMO_ORIGINAL ? { ...item, video_url: RITMO_SOURCE_PATH, video_duration_seconds: RITMO_SOURCE_DURATION, video_trim_in_seconds: 0, video_trim_out_seconds: null, subtitles: items.find(previous => previous.id === TIMBAL_RITMO_PREVIOUS_SOURCE)?.subtitles ?? item.subtitles ?? null } : item)
  }
  // The admin's current media is authoritative, including an empty/deleted video.
  // Never resurrect the retired demo or a local backup.
  return items.some(item => item.id === TIMBAL_INTRO_SOURCE) ? items.filter(item => item.id !== TIMBAL_INTRO_SOURCE) : items
}

export async function applyLocalTimbalIntro(sections: { id?: string; classes?: { id: string; items?: Item[] }[] }[] | null) {
  if (!(await usesLocalTimbalIntro())) return
  if (sections) separateTimbalWelcome(sections)
  for (const section of sections ?? []) applyLocalModulePresentation(section)
  for (const section of sections ?? []) for (const cls of section.classes ?? []) {
    if ([TIMBAL_INTRO_CLASS, TIMBAL_RITMO_CLASS, TIMBAL_VARIACIONES_CLASS].includes(cls.id) && cls.items) cls.items = replaceTimbalIntroItems(cls.items)
  }
}
