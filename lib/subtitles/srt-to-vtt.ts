// SRT → WebVTT conversion + the subtitle track shape shared by the admin
// uploader, ClassItemRenderer, and both video players.
//
// Browsers only render WebVTT in <track> elements, so admin-uploaded .srt
// files are converted at upload time. The transformation is small: strip BOM,
// normalize newlines, swap the comma decimal separator in timestamps for a
// period, and prepend the WEBVTT header. Numeric cue counters are valid VTT
// cue identifiers, so they stay.

export type SubtitleLang = 'en' | 'es'

export interface SubtitleTrackDef {
  lang: SubtitleLang
  label: string
  src: string
}

export const SUBTITLE_LABELS: Record<SubtitleLang, string> = {
  en: 'English',
  es: 'Español',
}

export function srtToVtt(raw: string): string {
  let text = raw.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  if (/^WEBVTT/.test(text.trimStart())) return text
  text = text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')
  return 'WEBVTT\n\n' + text.trim() + '\n'
}
