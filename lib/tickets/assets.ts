// Server-side inputs for the ticket PDF: brand fonts and default logo from
// this folder (traced into the server bundle via next.config.ts), and design
// images fetched from Storage.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { TicketDesign } from './design'
import type { TicketFontFiles } from './pdf'

const DIR = path.join(process.cwd(), 'lib', 'tickets')

let fontsPromise: Promise<TicketFontFiles> | null = null
let logoPromise: Promise<Uint8Array> | null = null

export function loadTicketFonts(): Promise<TicketFontFiles> {
  if (!fontsPromise) {
    const font = (name: string) => readFile(path.join(DIR, 'fonts', name)).then((b) => new Uint8Array(b))
    fontsPromise = Promise.all([
      font('BigShouldersDisplay-Black.ttf'),
      font('BigShouldersDisplay-ExtraBold.ttf'),
      font('HankenGrotesk-Regular.ttf'),
      font('HankenGrotesk-SemiBold.ttf'),
      font('DMMono-Medium.ttf'),
      font('InstrumentSerif-Italic.ttf'),
    ]).then(([displayBlack, displayBold, body, bodySemibold, mono, serif]) => ({
      displayBlack, displayBold, body, bodySemibold, mono, serif,
    }))
    fontsPromise.catch(() => { fontsPromise = null })
  }
  return fontsPromise
}

export function loadDefaultLogo(): Promise<Uint8Array> {
  if (!logoPromise) {
    logoPromise = readFile(path.join(DIR, 'assets', 'lmm-logo.png')).then((b) => new Uint8Array(b))
    logoPromise.catch(() => { logoPromise = null })
  }
  return logoPromise
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024
const imageCache = new Map<string, Promise<Uint8Array | null>>()

/** PNG/JPEG bytes from an http(s) URL, or null when missing/unsupported. */
export function fetchImageBytes(url: string | null | undefined): Promise<Uint8Array | null> {
  if (!url || !/^https?:\/\//i.test(url)) return Promise.resolve(null)
  const cached = imageCache.get(url)
  if (cached) return cached
  const pending = download(url)
  imageCache.set(url, pending)
  // Keep the cache small; images are re-uploaded under new names when changed.
  if (imageCache.size > 24) imageCache.delete(imageCache.keys().next().value!)
  pending.then((bytes) => { if (!bytes) imageCache.delete(url) })
  return pending
}

async function download(url: string): Promise<Uint8Array | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const length = Number(res.headers.get('content-length') ?? 0)
    if (length > MAX_IMAGE_BYTES) return null
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.length > MAX_IMAGE_BYTES) return null
    const png = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
    const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8
    return png || jpeg ? bytes : null
  } catch (error) {
    console.warn('[tickets] image fetch failed', url, error)
    return null
  }
}

/** Logo and artwork bytes for a design, honouring its logo/image choices. */
export async function resolveDesignImages(design: TicketDesign, eventImageUrl: string | null) {
  const [logo, image] = await Promise.all([
    design.logo === 'none' ? null : design.logo === 'custom' && design.logoUrl ? fetchImageBytes(design.logoUrl) : loadDefaultLogo(),
    design.image === 'none' ? null : fetchImageBytes(design.image === 'custom' ? design.imageUrl : eventImageUrl),
  ])
  return { logo, image }
}
