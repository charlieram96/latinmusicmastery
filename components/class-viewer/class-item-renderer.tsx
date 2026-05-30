import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Video, Dumbbell, Music } from 'lucide-react'
import { ExerciseQuiz } from '@/components/exercise-quiz'
import { TiptapReadOnly } from '@/components/class-viewer/tiptap-read-only'
import { PlaysenseStudioPlayer } from '@/components/playsense-studio/player/playsense-studio-player'
import { getScoreDocumentForClassItem, logPlaysenseStudioEvent } from '@/app/actions/playsense-studio'

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

export async function ClassItemRenderer({ item, userId, playerLayout = 'stack' }: ClassItemRendererProps) {
  // PlaySense Studio takes priority over the legacy Soundslice iframe whenever a
  // score_document is attached AND we have a media URL to drive the cursor
  // (video for VIDEO items, audio for JAM_SESSION).
  const playsenseStudioMediaUrl =
    item.item_type === 'VIDEO'
      ? item.video_url
      : item.item_type === 'JAM_SESSION'
        ? item.audio_url ?? item.video_url
        : null

  const playsenseStudioData =
    playsenseStudioEnabled && item.score_document_id && playsenseStudioMediaUrl
      ? (await getScoreDocumentForClassItem(item.id)).data ?? null
      : null

  // M9 cutover analytics — log when the legacy iframe is shown so we know
  // when zero traffic has migrated. Fire-and-forget; logPlaysenseStudioEvent
  // swallows errors.
  const renderingLegacyIframe =
    !playsenseStudioData && item.soundslice_embed_url !== null
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
        (playsenseStudioData && playsenseStudioMediaUrl && playerLayout === 'split' ? (
          // Split workspace renders edge-to-edge (the player draws its own frame).
          <PlaysenseStudioPlayer
            classItemId={item.id}
            videoUrl={playsenseStudioMediaUrl}
            score={playsenseStudioData.scoreDocument.parsedScore}
            tracks={playsenseStudioData.tracks}
            activeTimeMap={playsenseStudioData.activeTimeMap}
            layout="split"
          />
        ) : (
          <Card>
            <CardContent className="p-0">
              {playsenseStudioData && playsenseStudioMediaUrl ? (
                <PlaysenseStudioPlayer
                  classItemId={item.id}
                  videoUrl={playsenseStudioMediaUrl}
                  score={playsenseStudioData.scoreDocument.parsedScore}
                  tracks={playsenseStudioData.tracks}
                  activeTimeMap={playsenseStudioData.activeTimeMap}
                />
              ) : item.soundslice_embed_url ? (
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <iframe
                    src={item.soundslice_embed_url}
                    className="w-full h-full"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                  />
                </div>
              ) : item.video_url ? (
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video src={item.video_url} controls className="w-full h-full" />
                </div>
              ) : (
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                  <Video className="w-12 h-12 text-muted-foreground" />
                </div>
              )}
            </CardContent>
          </Card>
        ))}

      {/* QUIZ */}
      {item.item_type === 'QUIZ' && item.question && item.correct_answer && (
        <ExerciseQuiz
          exercise={{
            id: item.id,
            question: item.question,
            question_type: (item.question_type === 'text_answer' ? 'text' :
                           item.question_type === 'true_false' ? 'multiple_choice' :
                           item.question_type || 'multiple_choice') as 'multiple_choice' | 'text' | 'audio',
            options: item.question_type === 'true_false'
              ? ['True', 'False']
              : Array.isArray(item.options)
                ? (item.options as { text?: string }[]).map((o) => typeof o === 'string' ? o : o?.text || '')
                : null,
            correct_answer: item.correct_answer,
            explanation: item.explanation,
          }}
          userId={userId}
        />
      )}

      {/* EXERCISE */}
      {item.item_type === 'EXERCISE' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-green-500" />
              Exercise
            </CardTitle>
          </CardHeader>
          <CardContent>
            {item.question && (
              <p className="text-lg font-medium mb-4">{item.question}</p>
            )}
            {item.description && (
              <p className="text-muted-foreground whitespace-pre-wrap">{item.description}</p>
            )}
            {item.question && item.correct_answer && item.question_type && (
              <div className="mt-4">
                <ExerciseQuiz
                  exercise={{
                    id: item.id,
                    question: item.question,
                    question_type: (item.question_type === 'text_answer' ? 'text' :
                                   item.question_type === 'true_false' ? 'multiple_choice' :
                                   item.question_type || 'multiple_choice') as 'multiple_choice' | 'text' | 'audio',
                    options: item.question_type === 'true_false'
                      ? ['True', 'False']
                      : Array.isArray(item.options)
                        ? (item.options as { text?: string }[]).map((o) => typeof o === 'string' ? o : o?.text || '')
                        : null,
                    correct_answer: item.correct_answer,
                    explanation: item.explanation,
                  }}
                  userId={userId}
                />
              </div>
            )}
          </CardContent>
        </Card>
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

      {/* Rich Content (below any type) */}
      {item.rich_content && (
        <Card>
          <CardContent className="pt-6">
            <TiptapReadOnly content={item.rich_content} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
