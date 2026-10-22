import manifest from '@/lib/release/manifest.json'

/** Only approved public release media can be resolved; private documents are never exposed. */
export async function GET(_request: Request, { params }: { params: Promise<{ asset: string[] }> }) {
  const { asset } = await params
  const file = 'public/local-course-assets/' + asset.join('/')
  const files = manifest.files as Record<string, { bucket: string; key: string }>
  const entry = files[file]
  if (!entry || !['course-videos', 'play-sense-audio', 'quiz-media'].includes(entry.bucket)) return new Response('Not found', { status: 404 })
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL
  if (!base) return new Response('Media unavailable', { status: 503 })
  const url = new URL('/storage/v1/object/public/' + entry.bucket + '/' + entry.key.split('/').map(encodeURIComponent).join('/'), base)
  // Redirects let Storage serve Range requests directly, without buffering videos in a function.
  return new Response(null, { status: 307, headers: { Location: url.href, 'Cache-Control': 'public, max-age=3600' } })
}
