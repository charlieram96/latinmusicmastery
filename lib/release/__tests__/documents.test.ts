import { beforeEach, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
const mocks = vi.hoisted(() => ({ user: true, admin: false, access: false, download: vi.fn(), upload: vi.fn() }))
vi.mock('@/lib/release/manifest.json', () => ({ default: { release: 'test', files: {
  'local-artifacts/solfeo-infantil-course/books/local-solfeo-kids-m01-c01.json': { bucket: 'playsense-studio-scores', key: 'private/book.json.zip' },
} } }))
vi.mock('@/lib/supabase/admin', () => ({ getSupabaseAdmin: () => ({ storage: { from: () => ({ download: mocks.download, upload: mocks.upload }) } }) }))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: mocks.user ? { id: 'student' } : null } }) },
  from: (table: string) => ({ select: () => ({ eq: () => ({ single: async () => ({ data: table === 'profiles' ? { is_admin: mocks.admin } : { id: 'course', instrument: 'Solfeo' } }) }) }) }),
}) }))
vi.mock('@/lib/subscriptions', () => ({ canAccessCourse: async () => mocks.access }))
vi.mock('@/lib/supabase/require-admin', () => ({ requireAdmin: async () => mocks.admin ? { userId: 'admin' } : { error: 'Admin only' } }))
import { readReleaseDocument, writeReleaseDocument } from '../documents'
const file = 'local-artifacts/solfeo-infantil-course/books/local-solfeo-kids-m01-c01.json'
beforeEach(() => { vi.clearAllMocks(); mocks.user = true; mocks.admin = false; mocks.access = false })
it('never downloads private course content for unauthenticated or unenrolled readers', async () => {
  mocks.user = false
  await expect(readReleaseDocument(file)).rejects.toThrow('Not authenticated')
  mocks.user = true
  await expect(readReleaseDocument(file)).rejects.toThrow('Course access required')
  expect(mocks.download).not.toHaveBeenCalled()
})
it('reads the exact authored JSON from a private ZIP after course authorization', async () => {
  mocks.access = true
  const payload = await new JSZip().file('document.json', '{"title":"Cáscara"}').generateAsync({ type: 'uint8array' })
  mocks.download.mockResolvedValue({ data: new Blob([new Uint8Array(payload)]), error: null })
  expect(JSON.parse(await readReleaseDocument(file))).toEqual({ title: 'Cáscara' })
})
it('rejects unknown paths and prevents students from changing authored content', async () => {
  await expect(readReleaseDocument('../../.env.local')).rejects.toMatchObject({ code: 'ENOENT' })
  await expect(writeReleaseDocument(file, '{}')).rejects.toThrow('Admin only')
  expect(mocks.upload).not.toHaveBeenCalled()
})
it('stores admin edits in an actual private ZIP without changing permissions', async () => {
  mocks.admin = true; mocks.upload.mockResolvedValue({ error: null })
  await writeReleaseDocument(file, '{"title":"Updated"}')
  const archive = await JSZip.loadAsync(mocks.upload.mock.calls[0][1])
  expect(JSON.parse(await archive.file('document.json')!.async('string'))).toEqual({ title: 'Updated' })
  expect(mocks.upload.mock.calls[0][2]).toMatchObject({ contentType: 'application/zip' })
})
