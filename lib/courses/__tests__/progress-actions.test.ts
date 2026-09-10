import { beforeEach, describe, expect, it, vi } from 'vitest'

const mock = vi.hoisted(() => ({ getUser: vi.fn(), from: vi.fn(), read: vi.fn(), upsert: vi.fn(), revalidate: vi.fn() }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: mock.getUser }, from: mock.from }) }))
vi.mock('next/cache', () => ({ revalidatePath: mock.revalidate }))
import { markClassItemComplete, updateClassItemPosition } from '@/app/actions/progress'

beforeEach(() => {
  vi.clearAllMocks()
  mock.getUser.mockResolvedValue({ data: { user: { id: 'student' } } })
  mock.read.mockResolvedValue({ data: null, error: null })
  mock.upsert.mockResolvedValue({ error: null })
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle: mock.read, upsert: mock.upsert }
  query.select.mockReturnValue(query)
  query.eq.mockReturnValue(query)
  mock.from.mockReturnValue(query)
})

describe('automatic completion persistence', () => {
  it('uses the unique student/item pair and leaves the saved media position intact', async () => {
    expect(await markClassItemComplete('lesson-video')).toEqual({ success: true })
    expect(mock.upsert).toHaveBeenCalledWith({ user_id: 'student', class_item_id: 'lesson-video', completed: true, completed_at: expect.any(String) }, { onConflict: 'user_id,class_item_id' })
    expect(mock.revalidate).toHaveBeenCalledWith('/dashboard')
  })
  it('does not overwrite an existing completion timestamp on replay', async () => {
    mock.read.mockResolvedValue({ data: { completed: true }, error: null })
    expect(await markClassItemComplete('lesson-video')).toEqual({ success: true })
    expect(mock.upsert).not.toHaveBeenCalled()
  })
  it('saves position without resetting a completed item or racing a separate insert', async () => {
    expect(await updateClassItemPosition('lesson-video', 42)).toEqual({ success: true })
    expect(mock.read).not.toHaveBeenCalled()
    expect(mock.upsert).toHaveBeenCalledWith({ user_id: 'student', class_item_id: 'lesson-video', last_position_seconds: 42 }, { onConflict: 'user_id,class_item_id' })
  })
  it('requires an authenticated student', async () => {
    mock.getUser.mockResolvedValue({ data: { user: null } })
    expect(await markClassItemComplete('lesson-video')).toEqual({ error: 'Not authenticated' })
    expect(mock.from).not.toHaveBeenCalled()
  })
  it('returns read and write failures so the footer can offer a retry', async () => {
    mock.read.mockResolvedValueOnce({ data: null, error: { message: 'offline' } })
    expect(await markClassItemComplete('lesson-video')).toEqual({ error: 'offline' })
    expect(mock.upsert).not.toHaveBeenCalled()
    mock.upsert.mockResolvedValueOnce({ error: { message: 'write failed' } })
    expect(await markClassItemComplete('lesson-video')).toEqual({ error: 'write failed' })
  })
})
