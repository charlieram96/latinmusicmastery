// Readers/writers for the `class_items.subtitles` jsonb column: an array of
// { lang, src } capped at MAX_SUBTITLE_TRACKS. `parseSubtitles` is the tolerant
// read side (a bad element never breaks a lesson page); `validateSubtitlesInput`
// is the strict write side used by the updateClassItem server action.
// Pure module — no Next.js imports — so both are unit-testable.

import { MAX_SUBTITLE_TRACKS, subtitleLabel, type SubtitleTrackDef } from './srt-to-vtt'

/** One element of the stored jsonb array. */
export interface StoredSubtitle {
  lang: string
  src: string
}

const RESERVED_LANG = 'off' // the players' "captions off" sentinel

function normalizeLang(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const lang = raw.trim().toLowerCase()
  return lang.length > 0 ? lang : null
}

function readEntry(raw: unknown): StoredSubtitle | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { lang, src } = raw as Record<string, unknown>
  const code = normalizeLang(lang)
  if (code === null || typeof src !== 'string' || src.length === 0) return null
  return { lang: code, src }
}

/** Tolerant reader for the DB value. Returns [] for anything that is not an
    array, drops malformed elements, dedupes by language (first wins) and caps
    at MAX_SUBTITLE_TRACKS. */
export function parseSubtitles(json: unknown): SubtitleTrackDef[] {
  if (!Array.isArray(json)) return []
  const out: SubtitleTrackDef[] = []
  const seen = new Set<string>()
  for (const raw of json) {
    if (out.length >= MAX_SUBTITLE_TRACKS) break
    const entry = readEntry(raw)
    if (!entry || seen.has(entry.lang)) continue
    seen.add(entry.lang)
    out.push({ lang: entry.lang, label: subtitleLabel(entry.lang), src: entry.src })
  }
  return out
}

export type SubtitlesValidation =
  | { ok: true; value: StoredSubtitle[] }
  | { ok: false; error: string }

/** Strict guard for writes. Returns the normalized array on success. */
export function validateSubtitlesInput(input: unknown): SubtitlesValidation {
  if (!Array.isArray(input)) return { ok: false, error: 'Subtitles must be a list' }
  if (input.length > MAX_SUBTITLE_TRACKS) {
    return { ok: false, error: `At most ${MAX_SUBTITLE_TRACKS} subtitle tracks per video` }
  }
  const value: StoredSubtitle[] = []
  const seen = new Set<string>()
  for (const raw of input) {
    if (typeof raw !== 'object' || raw === null) {
      return { ok: false, error: 'Each subtitle track must be an object' }
    }
    const { lang, src } = raw as Record<string, unknown>
    const code = normalizeLang(lang)
    if (code === null) return { ok: false, error: 'Subtitle track is missing a language code' }
    if (code === RESERVED_LANG) return { ok: false, error: `"${RESERVED_LANG}" is not a valid language code` }
    if (seen.has(code)) return { ok: false, error: `Duplicate subtitle language "${code}"` }
    if (typeof src !== 'string' || !src.startsWith('https://')) {
      return { ok: false, error: `Subtitle track "${code}" must have an https URL` }
    }
    seen.add(code)
    value.push({ lang: code, src })
  }
  return { ok: true, value }
}
