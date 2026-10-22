import type { SubtitleTrackDef } from '@/lib/subtitles/srt-to-vtt'
import type { QuizQuestion } from '@/types/modules'
import type { PlayerSection } from '@/components/playsense-studio/player/playsense-studio-player'

export interface ProducedSolfeoLesson {
 classId:string
 title:{es:string;en:string}
 videoUrl:string
 posterUrl:string
 metronome?: import('@/lib/playsense-studio/lesson-metronome').LessonMetronome
 /** Authored screen boundaries for explicit, manual lesson navigation. */
 steps?:{start:number;end:number;title:string;kind:string}[]
 duration:number
 sections:PlayerSection[]
 questions:QuizQuestion[]
 subtitles?:SubtitleTrackDef[]
 description?:{es:string|null;en:string|null}
 richContent?:Record<string,unknown>|null
 completeScoreUrl?:string
 nextHref:string|null
}
