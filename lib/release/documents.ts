import { cache } from 'react'
import JSZip from 'jszip'
import { getSupabaseAdmin } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { canAccessCourse } from '@/lib/subscriptions'
import manifest from './manifest.json'

const bucket = 'playsense-studio-scores'
const courseId = '12468ffa-f23f-4e89-b2a2-ac28ffec3540'
const files = manifest.files as Record<string, { bucket: string; key: string }>
const missing = () => Object.assign(new Error('Document not found'), { code: 'ENOENT' })

// Request-scoped authorization: never cache a user's permission across requests.
const authorize = cache(async (write: boolean, outline: boolean, targetCourse: string = courseId) => {
  const client = await createClient()
  if (write) {
    const result = await requireAdmin(client)
    if ('error' in result) throw new Error(result.error)
    return
  }
  const { data: { user } } = await client.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  if (outline) return // The authenticated course catalogue has no answer keys.
  const { data: profile } = await client.from('profiles').select('is_admin').eq('id', user.id).single()
  if (profile?.is_admin) return
  const { data: course } = await client.from('courses').select('id,instrument,is_fundamentals').eq('id', targetCourse).single()
  if (!course || !await canAccessCourse(client, user.id, course, false)) throw new Error('Course access required')
})
function entry(file: string) {
  // Newly imported audio settings have a content-derived identity, never a caller-supplied path.
  const value = files[file] ?? ((/^local-artifacts\/studio-preview\/audio-sources\/[a-f0-9]{64}\.json$/.test(file) || /^local-artifacts\/studio-preview\/backups\/[a-f0-9-]+(?:-before-clear)?-\d+\.json$/.test(file)) ? {bucket, key:`releases/${manifest.release}/${file}.zip`} : undefined)
  if (!value || value.bucket !== bucket || !value.key.endsWith('.zip')) throw missing()
  return value
}
export async function readReleaseDocument(file: string): Promise<string> {
  const value = entry(file)
  await authorize(file.endsWith('/studio-preview/drafts.json') || file.includes('/studio-preview/backups/'), /\/(?:solfeo-course|solfeo-infantil-course)\/structure\.json$/.test(file) || file.startsWith('local-artifacts/studio-preview/audio-sources/'), file.includes('/studio-preview/') ? '197b393d-6d41-4147-9802-574919aa51fa' : courseId)
  const { data, error } = await getSupabaseAdmin().storage.from(bucket).download(value.key)
  if (error || !data) { if (error && ['404','400'].includes(String((error as {statusCode?:string}).statusCode)) && !files[file]) throw missing(); throw new Error('Unable to read published course document') }
  const archive = await JSZip.loadAsync(await data.arrayBuffer())
  const document = archive.file('document.json')
  if (!document) throw new Error('Invalid published course document')
  return document.async('string')
}
export async function writeReleaseDocument(file: string, text: string) {
  const value = entry(file)
  await authorize(true, false)
  // Keep authored JSON private inside an actual ZIP, a supported score package format.
  JSON.parse(text)
  const archive = await new JSZip().file('document.json', text).generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
  const { error } = await getSupabaseAdmin().storage.from(bucket).upload(value.key, archive, { upsert: true, contentType: 'application/zip', cacheControl: '0' })
  if (error) throw new Error('Unable to save published course document')
}
