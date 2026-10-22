/** Dubs available in this deployment, keyed by exact source to prevent mismatches. */
export interface LessonAudioTrack { lang: string; label: string; src: string }
export const LESSON_AUDIO: Record<string, readonly LessonAudioTrack[]> = {
  '/local-course-assets/codex-variaciones/preview.mp4': [
    { lang:'en', label:'English', src:'/local-course-assets/codex-variaciones/dub-en-original-percussion.flac' },
  ],
  'https://uaupfsnfgenyqmlfljpi.supabase.co/storage/v1/object/public/course-videos/d97c387a-fc08-4a7f-8057-a323fd667592-1788324873153.m4v': [
    { lang: 'en', label: 'English', src: '/audio/intro-timbal-en.mp3' },
  ],
}

export function lessonAudioTracks(videoSrc: string): readonly LessonAudioTrack[] {
  return LESSON_AUDIO[videoSrc] ?? []
}
