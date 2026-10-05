import { beforeEach, describe, expect, it, vi } from 'vitest'
const { db, insert, update } = vi.hoisted(() => ({ db: { from: vi.fn() }, insert: vi.fn(), update: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => db }))
vi.mock('@/lib/courses/instrument-options', () => ({ getCourseInstrumentOptions: async () => ['Theoretical', 'Piano', 'Saxophone', 'Trumpet'] }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
import { createCourseDraft, updateCourseSettings } from '../course-builder'

beforeEach(() => {
  vi.clearAllMocks()
  const row = { instrument: 'Theoretical', musical_style_id: 'style', is_fundamentals: false, teacher_id: 'old-teacher' }
  const chain: any = { select: vi.fn(() => chain), eq: vi.fn(() => chain), single: vi.fn(async () => ({ data: { id: 'course', ...row }, error: null })) }
  insert.mockReturnValue(chain)
  update.mockReturnValue(chain)
  db.from.mockImplementation((table) => table === 'teachers'
    ? { select: () => ({ eq: () => ({ single: async () => ({ data: { name: 'Raffy', instrument: 'Saxophone, Piano' } }) }) }) }
    : { ...chain, insert, update })
})
describe('course classification saving', () => {
  it('creates with the selected classification independent of instructor specialties', async () => {
    await createCourseDraft({ title: 'Solfeo', instrument: 'Theoretical', teacherId: 'raffy', musicalStyleId: 'style', isFundamentals: false })
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ instrument: 'Theoretical', teacher_id: 'raffy' }))
  })
  it('preserves the course classification when assigning another instructor', async () => {
    await updateCourseSettings('course', { teacher_id: 'raffy' })
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ instrument: 'Theoretical', teacher_id: 'raffy' }))
  })
  it('requires a course classification instead of falling back to the instructor', async () => {
    const result = await createCourseDraft({ title: 'Solfeo', instrument: null, teacherId: 'raffy', musicalStyleId: 'style', isFundamentals: false })
    expect(result.error).toBeTruthy()
    expect(insert).not.toHaveBeenCalled()
  })
})
