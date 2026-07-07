import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Video, Dumbbell, Music } from 'lucide-react'
import { TiptapReadOnly } from '@/components/class-viewer/tiptap-read-only'
import { PlaysenseStudioPlayer } from '@/components/playsense-studio/player/playsense-studio-player'
import {
  getExerciseMedia,
  getScoreDocumentForClassItem,
  getScoreSectionsForClassItem,
  logPlaysenseStudioEvent,
} from '@/app/actions/playsense-studio'
import { resolveLegacyAudioUrl } from '@/lib/play-sense/exercise-media'
import { getQuizQuestions } from '@/app/actions/quiz'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeRows, QUIZ_FIELDS } from '@/lib/i18n/localize'
import { QuizRunner } from '@/components/class-viewer/lesson-viewer/quiz-runner'
import { ExerciseView } from '@/components/class-viewer/lesson-viewer/exercise-view'
import { LessonVideoPlayer } from '@/components/class-viewer/lesson-viewer/lesson-video-player'
import { scoreToExerciseDefinition } from '@/lib/play-sense/score-to-exercise'
import type { SubtitleTrackDef } from '@/lib/subtitles/srt-to-vtt'

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
    subtitles_en_url: string | null
    subtitles_es_url: string | null
    score_document_id: string | null
    active_time_map_id: string | null
    question: string | null
    question_type: string | null
    options: unknown
    correct_answer: string | null
    explanation: string | null
    audio_url: string | null
    bpm: number | null
    key_signature: string | null
    rich_content: Record<string, unknown> | null
    video_duration_seconds: number | null
    description: string | null
  }
  userId: string
  /** 'split' renders the PlaySense media player as a resizable video|notation workspace. */
  playerLayout?: 'stack' | 'split'
}

export async function ClassItemRenderer({ item, playerLayout = 'stack' }: ClassItemRendererProps) {
  const locale = await getServerLocale()

  // Subtitle tracks for the demo video. Both languages are passed to the
  // players (the student can switch independently of the UI locale); the
  // locale only picks which one starts showing.
  const subtitleTracks: SubtitleTrackDef[] = []
  if (item.subtitles_en_url) {
    subtitleTracks.push({ lang: 'en', label: 'English', src: item.subtitles_en_url })
  }
  if (item.subtitles_es_url) {
    subtitleTracks.push({ lang: 'es', label: 'Español', src: item.subtitles_es_url })
  }

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

  // Exercises can be score-only (rhythm-highway test with no reference video), so
  // they fetch the score whenever one is attached; other types need a media URL
  // to drive the cursor.
  const needsScore =
    item.score_document_id &&
    (playsenseStudioMediaUrl || item.item_type === 'EXERCISE')

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
    }))
  const firstSection = playerSections[0] ?? null
  const hasVideoSections = playerSections.length > 0

  // Notation that exists but was never placed/sync-mapped (no video start time +
  // no time map). We still show it on the right: the player synthesizes a
  // tempo-based cursor from the score so the staff is visible immediately. The
  // accurate cursor appears once the lesson is sync-authored in PlaySense Studio.
  const firstUnplacedSection = !hasVideoSections ? videoSections[0] ?? null : null

  // EXERCISE play-part media: optional cropped video + instrument backing
  // tracks the student selects before playing.
  const exerciseMedia =
    item.item_type === 'EXERCISE' ? (await getExerciseMedia(item.id)).data ?? null : null
  const backingTracks = exerciseMedia?.backingTracks ?? []
  const exerciseVideo = exerciseMedia?.videoUrl
    ? {
        url: exerciseMedia.videoUrl,
        startSeconds: exerciseMedia.videoStartSeconds,
        timeMap: exerciseMedia.timeMap,
      }
    : null

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
    <div className="space-y-6">
      {/* VIDEO */}
      {item.item_type === 'VIDEO' &&
        (hasVideoSections && firstSection && item.video_url && playerLayout === 'split' ? (
          // Placed + sync-mapped notation → split workspace with an accurate cursor.
          <PlaysenseStudioPlayer
            classItemId={item.id}
            videoUrl={item.video_url}
            score={firstSection.score}
            tracks={firstSection.tracks}
            activeTimeMap={firstSection.activeTimeMap}
            sections={playerSections}
            layout="split"
            subtitles={subtitleTracks}
            defaultSubtitleLang={locale}
          />
        ) : firstUnplacedSection && item.video_url && playerLayout === 'split' ? (
          // Notation exists but isn't sync-mapped yet → still show it on the right.
          // No sections/timeMap: the player synthesizes a tempo-based cursor.
          <PlaysenseStudioPlayer
            classItemId={item.id}
            videoUrl={item.video_url}
            score={firstUnplacedSection.scoreDocument.parsedScore}
            tracks={firstUnplacedSection.tracks}
            activeTimeMap={null}
            layout="split"
            subtitles={subtitleTracks}
            defaultSubtitleLang={locale}
          />
        ) : item.video_url && !item.soundslice_embed_url ? (
          // No notation → polished full-width player. Description + notes render
          // below the workspace (page body + rich-content card), not on the side.
          <LessonVideoPlayer
            src={item.video_url}
            subtitles={subtitleTracks}
            defaultSubtitleLang={locale}
          />
        ) : (
          <Card className="overflow-hidden rounded-2xl border-border shadow-warm">
            <CardContent className="p-0">
              {item.soundslice_embed_url ? (
                <div className="aspect-video overflow-hidden bg-black">
                  <iframe
                    src={item.soundslice_embed_url}
                    className="w-full h-full"
                    allow="autoplay; fullscreen"
                    allowFullScreen
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
                <div className="aspect-video overflow-hidden bg-black">
                  <video
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
                  </video>
                </div>
              </CardContent>
            </Card>
          ) : null}
          <QuizRunner classItemId={item.id} questions={quizQuestions} kind="Quiz" />
        </>
      )}

      {/* EXERCISE — score-driven (video + staff + rhythm highway), with optional
          comprehension questions. Falls back to a plain question card for legacy
          exercises that have no score attached. */}
      {item.item_type === 'EXERCISE' && (
        <>
          {item.description && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5 text-green-500" />
                  Exercise
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">{item.description}</p>
              </CardContent>
            </Card>
          )}

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
            />
          ) : null}

          {/* Optional comprehension questions authored for the exercise. */}
          {quizQuestions.length > 0 && (
            <QuizRunner classItemId={item.id} questions={quizQuestions} kind="Exercise" />
          )}
        </>
      )}

      {/* JAM_SESSION */}
      {item.item_type === 'JAM_SESSION' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Music className="w-5 h-5 text-orange-500" />
              Jam Session
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {playsenseStudioData && playsenseStudioMediaUrl ? (
              <PlaysenseStudioPlayer
                classItemId={item.id}
                videoUrl={playsenseStudioMediaUrl}
                score={playsenseStudioData.scoreDocument.parsedScore}
                tracks={playsenseStudioData.tracks}
                activeTimeMap={playsenseStudioData.activeTimeMap}
                layout={playerLayout}
              />
            ) : (
              <>
                {item.audio_url && (
                  <audio controls className="w-full" src={item.audio_url} />
                )}
                {item.soundslice_embed_url && (
                  <div className="aspect-video bg-black rounded-lg overflow-hidden">
                    <iframe
                      src={item.soundslice_embed_url}
                      className="w-full h-full"
                      allow="autoplay; fullscreen"
                      allowFullScreen
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
                  Key: {item.key_signature}
                </Badge>
              )}
            </div>
            {item.description && (
              <p className="text-muted-foreground whitespace-pre-wrap">{item.description}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Rich Content (below any type) — plain prose, no card/background. */}
      {item.rich_content && (
        <div className="text-[15.5px] leading-[1.7] text-foreground/90">
          <TiptapReadOnly content={item.rich_content} />
        </div>
      )}
    </div>
  )
}
