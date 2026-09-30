import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { VideoWatermark } from '@/components/playsense-studio/shared/video-watermark';
import { Badge } from '@/components/ui/badge'
import { Video, Music } from 'lucide-react'
import { LessonWrittenContent } from './lesson-written-content'
import { PlaysenseStudioPlayer } from '@/components/playsense-studio/player/playsense-studio-player'
import {
  getExerciseMedia,
  getScoreDocumentForClassItem,
  getScoreSectionsForClassItem,
  logPlaysenseStudioEvent,
} from '@/app/actions/playsense-studio'
import { jamRendersGradedGame, resolveLegacyAudioUrl, toExerciseVideo } from '@/lib/play-sense/exercise-media'
import { getQuizQuestions } from '@/app/actions/quiz'
import { readQuizSettings } from '@/lib/quiz/quiz-settings'
import { getServerTranslator } from '@/lib/i18n/server'
import { localizeRows, QUIZ_FIELDS } from '@/lib/i18n/localize'
import { QuizRunner } from '@/components/class-viewer/lesson-viewer/quiz-runner'
import { ExerciseView } from '@/components/class-viewer/lesson-viewer/exercise-view'
import { ScoreExerciseGame } from '@/components/class-viewer/lesson-viewer/score-exercise-game'
import { LessonVideoPlayer } from '@/components/class-viewer/lesson-viewer/lesson-video-player'
import { scoreToExerciseDefinition } from '@/lib/play-sense/score-to-exercise'
import { parseSubtitles } from '@/lib/subtitles/tracks'
import { LessonActivityBoundary } from './lesson-viewer/lesson-progress-context'
import { LessonMediaEmbed } from './lesson-viewer/lesson-media-embed'
import { completionRequirements } from '@/lib/courses/lesson-completion'

// Feature flag — set PLAYSENSE_STUDIO_ENABLED=false in env to roll back to the legacy
// iframe path even when a class item has a score attached. Default true so
// production lights up automatically once admins start attaching scores.
const playsenseStudioEnabled = process.env.PLAYSENSE_STUDIO_ENABLED !== 'false'

interface ClassItemRendererProps {
  item: {
    id: string
    title: string
    item_type: string
    soundslice_embed_url: string | null
    video_url: string | null
    video_trim_in_seconds?: number | null
    video_trim_out_seconds?: number | null
    subtitles: unknown
    score_document_id: string | null
    active_time_map_id: string | null
    question: string | null
    question_type: string | null
    options: unknown
    correct_answer: string | null
    explanation: string | null
    audio_url: string | null
    metronome_anchor_seconds?: number | null
    bpm: number | null
    key_signature: string | null
    rich_content: Record<string, unknown> | null
    video_duration_seconds: number | null
    description: string | null
    quiz_settings?: unknown
  }
  userId: string
  /** 'split' renders the PlaySense media player as a resizable video|notation workspace. */
  playerLayout?: 'stack' | 'split'
  /** Where "Continue to next part" goes at the end of a quiz/exercise; omitted when this is the last part. */
  nextHref?: string | null
  /** Development-only lesson showcase using existing authorized lesson content. */
  previewExercise?: boolean
  /** Development-only video/score review without writing playback progress. */
  previewLesson?: boolean
  /** The course teacher, named in the exercise's Watch message. */
  teacherName?: string | null
}

export async function ClassItemRenderer({ item, playerLayout = 'stack', nextHref = null, previewExercise = false, previewLesson = false, teacherName = null }: ClassItemRendererProps) {
  const { t, locale } = await getServerTranslator()

  // Subtitle tracks for the demo video. Every language is passed to the
  // players (the student can switch independently of the UI locale); the
  // locale only picks which one starts showing.
  const subtitleTracks = parseSubtitles(item.subtitles)

  // PlaySense Studio takes priority over the legacy Soundslice iframe whenever a
  // score_document is attached AND we have a media URL to drive the cursor
  // (video for VIDEO items, audio for JAM_SESSION).
  const playsenseStudioMediaUrl =
    item.item_type === 'VIDEO'
      ? item.video_url
      : item.item_type === 'JAM_SESSION'
        ? item.audio_url ?? item.video_url
        : item.item_type === 'QUIZ' || item.item_type === 'EXERCISE'
          ? item.video_url
          : null

  // Exercises and jam sessions can be score-only (the graded highway needs no
  // reference media), so they fetch the score whenever one is attached; other
  // types need a media URL to drive the cursor.
  const needsScore =
    item.score_document_id &&
    (playsenseStudioMediaUrl || item.item_type === 'EXERCISE' || item.item_type === 'JAM_SESSION')

  const playsenseStudioData =
    playsenseStudioEnabled && needsScore
      ? (await getScoreDocumentForClassItem(item.id)).data ?? null
      : null

  // VIDEO lessons carry MULTIPLE scored sections, each active over a video
  // time-range. EXERCISE items reuse the same model for their WATCH part (the
  // demo video synced to notation). Fetch them and keep the ones that are
  // placed + published.
  const videoSections =
    (item.item_type === 'VIDEO' || item.item_type === 'EXERCISE') &&
    playsenseStudioEnabled &&
    !!item.video_url
      ? (await getScoreSectionsForClassItem(item.id)).data ?? []
      : []
  const playerSections = videoSections
    .filter((s) => s.videoStartSeconds != null && s.activeTimeMap != null)
    .map((s) => ({
      id: s.sectionId,
      label: s.label,
      videoStartSeconds: s.videoStartSeconds,
      videoEndSeconds: s.videoEndSeconds,
      score: s.scoreDocument.parsedScore,
      tracks: s.tracks,
      activeTimeMap: s.activeTimeMap,
      metronomeAnchorSeconds: s.metronomeAnchorSeconds,
    }))
  const firstSection = playerSections[0] ?? null
  const hasVideoSections = playerSections.length > 0

  // Notation that exists but was never placed/sync-mapped (no video start time +
  // no time map). We still show it on the right: the player synthesizes a
  // tempo-based cursor from the score so the staff is visible immediately. The
  // accurate cursor appears once the lesson is sync-authored in PlaySense Studio.
  const firstUnplacedSection = !hasVideoSections ? videoSections[0] ?? null : null

  if (process.env.NODE_ENV === 'development' && previewExercise && item.video_url && firstSection) {
    return <ScoreExerciseGame
      key={`preview-${item.id}`}
      preview
      exercise={{ ...scoreToExerciseDefinition(firstSection.score, { id: `preview-${item.id}`, title: firstSection.label ?? item.title }), loopCount: 4 }}
      score={firstSection.score}
      exerciseVideo={{ url: item.video_url, startSeconds: firstSection.videoStartSeconds ?? 0, timeMap: firstSection.activeTimeMap }}
    />
  }

  // Graded play-part media: an EXERCISE's optional cropped video + instrument
  // backing tracks the student selects before playing, or (Studio rework P5,
  // Task 8) a JAM_SESSION's own audio_url carried the same way.
  const exerciseMedia =
    item.item_type === 'EXERCISE' || item.item_type === 'JAM_SESSION'
      ? (await getExerciseMedia(item.id)).data ?? null
      : null
  const backingTracks = exerciseMedia?.backingTracks ?? []
  const exerciseVideo = toExerciseVideo(exerciseMedia)

  // Quizzes (and legacy quiz-style exercises) are a series of questions stored
  // in quiz_questions. Fetch them server-side so the runner renders immediately.
  const quizQuestions =
    item.item_type === 'QUIZ' || item.item_type === 'EXERCISE'
      ? localizeRows(
          (await getQuizQuestions(item.id)).data as unknown as Record<string, unknown>[],
          locale,
          QUIZ_FIELDS
        ) as unknown as Awaited<ReturnType<typeof getQuizQuestions>>['data']
      : []

  // M9 cutover analytics — log when the legacy iframe is shown so we know
  // when zero traffic has migrated. Fire-and-forget; logPlaysenseStudioEvent
  // swallows errors.
  const renderingLegacyIframe =
    !playsenseStudioData && !hasVideoSections && item.soundslice_embed_url !== null
  if (renderingLegacyIframe) {
    void logPlaysenseStudioEvent({
      eventType: 'playsense_studio_legacy_iframe_shown',
      classItemId: item.id,
      metadata: {
        item_type: item.item_type,
        playsense_studio_enabled: playsenseStudioEnabled,
        has_score_attached: item.score_document_id !== null,
      },
    })
  }

  return (
    <LessonActivityBoundary key={item.id} classItemId={item.id}
      required={completionRequirements(item.item_type, !!playsenseStudioData, quizQuestions.length > 0)}
      disabled={process.env.NODE_ENV === 'development' && (previewLesson || previewExercise)}>
      {/* VIDEO */}
      {item.item_type === 'VIDEO' &&
        (hasVideoSections && firstSection && item.video_url && playerLayout === 'split' ? (
          // Placed + sync-mapped notation → split workspace with an accurate cursor.
          <PlaysenseStudioPlayer
            readOnly={process.env.NODE_ENV === 'development' && previewLesson}
            classItemId={item.id}
            classItemTitle={item.title}
            lessonMetronome={{bpm:item.bpm??120,anchorSeconds:item.metronome_anchor_seconds??null}}
            videoUrl={item.video_url}
            score={firstSection.score}
            tracks={firstSection.tracks}
            activeTimeMap={firstSection.activeTimeMap}
            sections={playerSections}
            layout="split"
            subtitles={subtitleTracks}
            defaultSubtitleLang={locale}
            trimInSeconds={item.video_trim_in_seconds ?? 0}
            trimOutSeconds={item.video_trim_out_seconds ?? null}
          />
        ) : firstUnplacedSection && item.video_url && playerLayout === 'split' ? (
          // Notation exists but isn't sync-mapped yet → still show it on the right.
          // No sections/timeMap: the player synthesizes a tempo-based cursor.
          <PlaysenseStudioPlayer
            readOnly={process.env.NODE_ENV === 'development' && previewLesson}
            classItemId={item.id}
            classItemTitle={item.title}
            lessonMetronome={{bpm:item.bpm??120,anchorSeconds:item.metronome_anchor_seconds??null}}
            videoUrl={item.video_url}
            score={firstUnplacedSection.scoreDocument.parsedScore}
            tracks={firstUnplacedSection.tracks}
            activeTimeMap={null}
            layout="split"
            subtitles={subtitleTracks}
            defaultSubtitleLang={locale}
            trimInSeconds={item.video_trim_in_seconds ?? 0}
            trimOutSeconds={item.video_trim_out_seconds ?? null}
          />
        ) : item.video_url && !item.soundslice_embed_url ? (
          // No notation → polished full-width player. Description + notes render
          // below the workspace (page body + rich-content card), not on the side.
          <LessonVideoPlayer
            metronome={{bpm:item.bpm??120,anchorSeconds:item.metronome_anchor_seconds??null}}
            src={item.video_url}
            subtitles={subtitleTracks}
            defaultSubtitleLang={locale}
            trimInSeconds={item.video_trim_in_seconds ?? 0}
            trimOutSeconds={item.video_trim_out_seconds ?? null}
          />
        ) : (
          <Card className="overflow-hidden rounded-2xl border-border shadow-warm">
            <CardContent className="p-0">
              {item.soundslice_embed_url ? (
                <div className="relative aspect-video overflow-hidden bg-black">
                  <LessonMediaEmbed
                    src={item.soundslice_embed_url}
                    className="w-full h-full"
                  />
                </div>
              ) : (
                <div className="aspect-video flex items-center justify-center bg-muted">
                  <Video className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}

      {/* QUIZ — optional intro video/notation above a multi-question runner */}
      {item.item_type === 'QUIZ' && (
        <>
          {playsenseStudioData && playsenseStudioMediaUrl ? (
            <Card>
              <CardContent className="p-0">
                <PlaysenseStudioPlayer
                  classItemId={item.id}
                  videoUrl={playsenseStudioMediaUrl}
                  score={playsenseStudioData.scoreDocument.parsedScore}
                  tracks={playsenseStudioData.tracks}
                  activeTimeMap={playsenseStudioData.activeTimeMap}
                  subtitles={subtitleTracks}
                  defaultSubtitleLang={locale}
                />
              </CardContent>
            </Card>
          ) : item.video_url ? (
            <Card className="overflow-hidden rounded-2xl border-border shadow-warm">
              <CardContent className="p-0">
                <div className="relative aspect-video overflow-hidden bg-black">
                  <video controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback onContextMenu={event => event.preventDefault()}
                    src={item.video_url}
                    controls
                    crossOrigin={subtitleTracks.length > 0 ? 'anonymous' : undefined}
                    className="w-full h-full"
                  >
                    {subtitleTracks.map((t) => (
                      <track
                        key={t.src}
                        kind="subtitles"
                        src={t.src}
                        srcLang={t.lang}
                        label={t.label}
                        default={t.lang === locale}
                      />
                    ))}
                  </video><VideoWatermark nativeControls />
                </div>
              </CardContent>
            </Card>
          ) : null}
          <QuizRunner key={item.id} classItemId={item.id} questions={quizQuestions} kind="Quiz" title={item.title} nextHref={nextHref} settings={readQuizSettings(item.quiz_settings)} />
        </>
      )}

      {/* EXERCISE — score-driven (video + staff + rhythm highway), with optional
          comprehension questions. Keep the video available even without a score. */}
      {item.item_type === 'EXERCISE' && (
        <>
          {playsenseStudioData ? (
            <ExerciseView
              classItemId={item.id}
              videoUrl={playsenseStudioMediaUrl}
              score={playsenseStudioData.scoreDocument.parsedScore}
              tracks={playsenseStudioData.tracks}
              activeTimeMap={playsenseStudioData.activeTimeMap}
              exercise={scoreToExerciseDefinition(playsenseStudioData.scoreDocument.parsedScore, {
                id: item.id,
                title: item.title,
                description: item.description ?? undefined,
                // Legacy play-along (demo-video audio as backing) only until
                // explicit backing tracks / an exercise video are authored.
                audioUrl: resolveLegacyAudioUrl({
                  legacyMediaUrl: playsenseStudioMediaUrl,
                  hasBackingTracks: backingTracks.length > 0,
                  hasExerciseVideo: !!exerciseVideo,
                }),
              })}
              sections={playerSections}
              playerLayout={playerLayout}
              backingTracks={backingTracks}
              exerciseVideo={exerciseVideo}
              play={exerciseMedia?.play ?? null}
              teacherName={teacherName}
            />
          ) : item.video_url ? (
            <LessonVideoPlayer
            metronome={{bpm:item.bpm??120,anchorSeconds:item.metronome_anchor_seconds??null}}
              src={item.video_url}
              subtitles={subtitleTracks}
              defaultSubtitleLang={locale}
              trimInSeconds={item.video_trim_in_seconds ?? 0}
              trimOutSeconds={item.video_trim_out_seconds ?? null}
            />
          ) : exerciseVideo ? (
            <LessonVideoPlayer
            metronome={{bpm:item.bpm??120,anchorSeconds:item.metronome_anchor_seconds??null}}
              src={exerciseVideo.url}
              trimInSeconds={exerciseVideo.startSeconds ?? 0}
              trimOutSeconds={exerciseVideo.trimOutSeconds ?? null}
            />
          ) : null}

          {/* Optional comprehension questions authored for the exercise. */}
          {quizQuestions.length > 0 && (
            <QuizRunner key={item.id} classItemId={item.id} questions={quizQuestions} kind="Exercise" title={item.title} nextHref={nextHref} />
          )}
        </>
      )}

      {/* JAM_SESSION */}
      {item.item_type === 'JAM_SESSION' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="w-5 h-5 text-orange-500" />
              {t('dashboard.classViewer.itemTypes.jamSession')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* A jam session's whole score is graded (Studio rework P5, Task 8):
                the same ScoreExerciseGame an EXERCISE's play part uses, with
                the jam's own audio_url as its media — played AUDIBLY
                (mediaAudible, fix round 1), unlike an exercise's silent
                reference video, since it's the track the student plays along
                with. Without a score, this keeps the legacy audio/video/embed
                path. */}
            {jamRendersGradedGame(item.item_type, !!playsenseStudioData) && playsenseStudioData ? (
              <ScoreExerciseGame
                exercise={scoreToExerciseDefinition(playsenseStudioData.scoreDocument.parsedScore, {
                  id: item.id,
                  title: item.title,
                  description: item.description ?? undefined,
                })}
                score={playsenseStudioData.scoreDocument.parsedScore}
                backingTracks={backingTracks}
                exerciseVideo={exerciseVideo}
                play={exerciseMedia?.play ?? null}
                mediaAudible
              />
            ) : (
              <>
                {item.audio_url ? (
                  <audio controls className="w-full" src={item.audio_url} />
                ) : item.video_url ? (
                  <LessonVideoPlayer src={item.video_url} subtitles={subtitleTracks} defaultSubtitleLang={locale} />
                ) : null}
                {item.soundslice_embed_url && (
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <LessonMediaEmbed
                      src={item.soundslice_embed_url}
                      className="w-full h-full"
                    />
                  </div>
                )}
              </>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              {item.bpm && (
                <Badge variant="outline" className="gap-1">
                  BPM: {item.bpm}
                </Badge>
              )}
              {item.key_signature && (
                <Badge variant="outline" className="gap-1">
                  {t('dashboard.classViewer.renderer.key', { key: item.key_signature })}
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <LessonWrittenContent description={item.description} richContent={item.rich_content} locale={locale}/>

    </LessonActivityBoundary>
  )
}
