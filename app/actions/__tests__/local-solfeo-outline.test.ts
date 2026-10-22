import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import outline from '@/local-artifacts/solfeo-course/structure.json'
const mocks = vi.hoisted(() => ({ host: 'localhost:3000', readFile: vi.fn(), writeFile: vi.fn(), rename: vi.fn(), createClient: vi.fn() }))
vi.mock('next/headers', () => ({ headers: async () => new Headers({ host: mocks.host }) }))
vi.mock('node:fs/promises', () => ({ readFile: mocks.readFile, writeFile: mocks.writeFile, rename: mocks.rename }))
vi.mock('@/lib/supabase/server', () => ({ createClient: mocks.createClient }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { getCourseStructure, updateClass, updateClassItem, updateCourseSettings, reorderClasses } from '../course-builder'
import { usesLocalSolfeo } from '@/lib/courses/local-solfeo-draft'

beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('NODE_ENV', 'development'); mocks.host = 'localhost:3000'
  mocks.readFile.mockResolvedValue(JSON.stringify(outline)); mocks.writeFile.mockResolvedValue(undefined); mocks.rename.mockResolvedValue(undefined)
})
afterEach(() => vi.unstubAllEnvs())
describe('local-only Solfeo outline', () => {
  it('reads the local structure without connecting to the shared database', async () => {
    const result = await getCourseStructure(outline.courseId)
    expect(result.data).toHaveLength(12); expect(mocks.createClient).not.toHaveBeenCalled()
  })
  it('saves class names only to the local file', async () => {
    const id = outline.sections[0].classes[0].id
    await updateClass(id, { title_es: 'Nombre revisado' })
    const saved = JSON.parse(mocks.writeFile.mock.calls[0][1])
    expect(saved.sections[0].classes[0].title_es).toBe('Nombre revisado')
    expect(mocks.rename).toHaveBeenCalledOnce(); expect(mocks.createClient).not.toHaveBeenCalled()
  })
  it('blocks remote publishing and unsupported item fields', async () => {
    expect((await updateCourseSettings(outline.courseId, { is_published: true })).error).toBeTruthy()
    await expect(updateClassItem(outline.sections[0].classes[0].items[0].id, { question: 'Not allowed yet' })).rejects.toThrow('Unsupported local class item field')
    expect(mocks.createClient).not.toHaveBeenCalled(); expect(mocks.writeFile).not.toHaveBeenCalled()
  })
  it('rejects incomplete orders without dropping local classes', async () => {
    await expect(reorderClasses(outline.sections[0].id, [])).rejects.toThrow('Invalid local order')
    expect(mocks.writeFile).not.toHaveBeenCalled(); expect(mocks.createClient).not.toHaveBeenCalled()
  })
  it('keeps development overlays local and enables the approved production snapshot', async () => {
    mocks.host = 'latinmusicmastery.com'
    expect(await usesLocalSolfeo(outline.courseId)).toBe(false)
    await expect(usesLocalSolfeo(outline.sections[0].id)).rejects.toThrow('only on localhost')
    mocks.host = 'localhost:3000'; vi.stubEnv('NODE_ENV', 'production')
    expect(await usesLocalSolfeo(outline.courseId)).toBe(true)
  })
  it('contains the 149 authored lessons with valid unique item identities', () => {
    const ids: string[] = []
    for (const section of outline.sections) {
      expect(section.description).toBeNull(); expect(section.description_es).toBeNull()
      expect(section.classes.at(-1)?.items.at(-1)?.item_type).toBe('QUIZ')
      for (const cls of section.classes) {
        ids.push(cls.id); expect(cls.description).toBeNull(); expect(cls.description_es).toBeNull()
        expect(cls.title_es).toBeTruthy()
        for (const item of cls.items) {
          ids.push(item.id); expect(['EXERCISE', 'QUIZ', 'VIDEO']).toContain(item.item_type)
          if (item.item_type === 'VIDEO' && item.video_url) {
            expect(item.video_url).toMatch(/^\/local-course-assets\//)
            expect(item.video_duration_seconds).toBeGreaterThan(0)
          }
        }
      }
    }
    expect(outline.sections.flatMap(s=>s.classes)).toHaveLength(149)
    expect(outline.sections.flatMap(s=>s.classes).every(c=>(c.items.some(i=>i.item_type==='VIDEO')&&c.items.some(i=>i.item_type==='EXERCISE'))||(c.items.length===1&&c.items[0].item_type==='QUIZ'))).toBe(true)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
