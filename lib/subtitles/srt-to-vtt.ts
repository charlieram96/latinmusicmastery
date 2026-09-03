// SRT → WebVTT conversion + the subtitle track shape shared by the admin
// uploader, ClassItemRenderer, and both video players.
//
// Browsers only render WebVTT in <track> elements, so admin-uploaded .srt
// files are converted at upload time. The transformation is small: strip BOM,
// normalize newlines, swap the comma decimal separator in timestamps for a
// period, and prepend the WEBVTT header. Numeric cue counters are valid VTT
// cue identifiers, so they stay.

/** Lowercase BCP-47 language code of a subtitle track (`en`, `pt`, `zh`, …). */
export type SubtitleLang = string

export interface SubtitleTrackDef {
  lang: SubtitleLang
  label: string
  src: string
}

/** Languages the course builder offers, in picker order. Labels are native
    names so the caption menu reads naturally whatever the UI locale. Mirrored
    in ios/…/LMMModels/ClassItemSubtitle.swift — keep the two lists in sync. */
export const SUBTITLE_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Español' },
  { code: 'pt', label: 'Português' },
  { code: 'fr', label: 'Français' },
  { code: 'it', label: 'Italiano' },
  { code: 'de', label: 'Deutsch' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'ja', label: '日本語' },
  { code: 'zh', label: '中文' },
] as const

/** Hard cap per video, also enforced by the class_items_subtitles_shape CHECK. */
export const MAX_SUBTITLE_TRACKS = 9

const LABEL_BY_CODE: Record<string, string> = Object.fromEntries(
  SUBTITLE_LANGUAGES.map((l) => [l.code, l.label])
)

/** Native display name for a language code; unknown codes fall back to the code. */
export function subtitleLabel(code: string): string {
  return LABEL_BY_CODE[code] ?? code
}

export function srtToVtt(raw: string): string {
  let text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (/^WEBVTT/.test(text.trimStart())) return text
  text = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  return 'WEBVTT\n\n' + text.trim() + '\n'
}
