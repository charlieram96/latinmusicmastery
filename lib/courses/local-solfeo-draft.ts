import { publishedContentEnabled } from '@/lib/release/content'
import { readReleaseDocument, writeReleaseDocument } from '@/lib/release/documents'
/** File-backed outline for the local Solfeo editorial pass. Never writes to Supabase. */
import { headers } from 'next/headers'
import { readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { SectionWithClasses } from '@/components/admin/course-studio/types'

export const LOCAL_SOLFEO_COURSE_ID = '12468ffa-f23f-4e89-b2a2-ac28ffec3540'
const file = path.join(process.cwd(), 'local-artifacts/solfeo-course/structure.json')
const prefix = 'local-solfeo-'
export const newLocalSolfeoId = () => prefix + randomUUID()

export async function usesLocalSolfeo(id: string): Promise<boolean> {
  if (id !== LOCAL_SOLFEO_COURSE_ID && !id.startsWith(prefix)) return false
  if (publishedContentEnabled()) return true
  const host = (await headers()).get('host')?.split(':')[0]
  const enabled = process.env.NODE_ENV === 'development' && (host === 'localhost' || host === '127.0.0.1')
  if (id.startsWith(prefix) && !enabled) throw new Error('This outline is available only on localhost.')
  return enabled
}

export async function readLocalSolfeo() {
  const draft = JSON.parse(publishedContentEnabled() ? await readReleaseDocument('local-artifacts/solfeo-course/structure.json') : await readFile(file, 'utf8')) as { courseId: string; thumbnail_url?: string; description?: string; description_es?: string; sections: SectionWithClasses[] }
  if (draft.courseId !== LOCAL_SOLFEO_COURSE_ID) throw new Error('Unexpected local course')
  return draft
}

let pending: Promise<unknown> = Promise.resolve()
export async function editLocalSolfeo<T>(edit: (sections: SectionWithClasses[]) => T): Promise<T> {
  if (!(await usesLocalSolfeo(LOCAL_SOLFEO_COURSE_ID))) throw new Error('Local outline is unavailable')
  const next = pending.then(async () => {
    const draft = await readLocalSolfeo()
    const result = edit(draft.sections)
    const temporary = file + '.tmp'
    if (publishedContentEnabled()) await writeReleaseDocument('local-artifacts/solfeo-course/structure.json', JSON.stringify(draft, null, 2) + '\n')
    else { await writeFile(temporary, JSON.stringify(draft, null, 2) + '\n'); await rename(temporary, file) }
    return result
  })
  pending = next.catch(() => undefined)
  return next
}

export function localSection(sections: SectionWithClasses[], id: string) {
  const section = sections.find(s => s.id === id)
  if (!section) throw new Error('Local module not found')
  return section
}
export function localClass(sections: SectionWithClasses[], id: string) {
  const cls = sections.flatMap(s => s.classes).find(c => c.id === id)
  if (!cls) throw new Error('Local class not found')
  return cls
}
export function localItem(sections: SectionWithClasses[], id: string) {
  const item = sections.flatMap(s => s.classes).flatMap(c => c.items).find(i => i.id === id)
  if (!item) throw new Error('Local item not found')
  return item
}
export function orderLocal<T extends { id: string; order_index: number }>(rows: T[], ids: string[]) {
  if (ids.length !== rows.length || new Set(ids).size !== rows.length || ids.some(id => !rows.some(row => row.id === id))) throw new Error('Invalid local order')
  rows.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id))
  rows.forEach((row, index) => { row.order_index = index })
}

/** Local cover metadata never replaces the shared course record. */
export async function localSolfeoThumbnail(id: string, fallback: string | null) {
  if (!(await usesLocalSolfeo(id))) return fallback
  return (await readLocalSolfeo()).thumbnail_url ?? fallback
}
