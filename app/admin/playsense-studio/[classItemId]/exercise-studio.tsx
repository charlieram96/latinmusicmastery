'use client';

// PlaySense Studio — two-part EXERCISE authoring.
//
// An exercise lesson has two independent artifacts:
//   • WATCH — the teacher's demo video with scored sections synced to it,
//     authored in the same sections workspace VIDEO lessons use
//     (class_item_score_sections; publishes never touch the class item's own
//     score/map columns).
//   • EXERCISE — the separate graded score (class_items.score_document_id),
//     edited at fixed BPM and played by students as the rhythm highway.
//
// This thin shell owns which part is showing and injects a segmented toggle
// into whichever workspace's app bar is mounted. Switching parts refetches the
// target part's data first — both workspaces autosave to the DB but seed from
// props on mount, so a stale `initial*` would otherwise resurrect old state.
//
// NOTE: the refetchers arrive as BOUND SERVER ACTIONS (props from page.tsx)
// instead of being imported here — importing the actions module directly from
// this client file deadlocks the Turbopack production build (Next 16.0.10;
// reproduced deterministically: ~45s of compile, then a permanent idle hang).

import { Loader2, MonitorPlay, Target } from 'lucide-react';
import { useState, useTransition } from 'react';
import type {
  ClassItemScorePayload,
  ClassItemScoreSection,
  ExerciseMedia,
} from '@/app/actions/playsense-studio';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';
import { StudioSetup } from '@/components/playsense-studio/studio/studio-setup';
import { WatchVideoSetup } from '@/components/playsense-studio/studio/watch-video-setup';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { StudioWorkspace } from './studio-workspace';
import { VideoSectionsWorkspace } from './video-sections-workspace';

type Part = 'watch' | 'exercise';

interface ExercisePayload {
  scoreDocumentId: string;
  initialScore: ScoreDocument;
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
}

export interface ExerciseStudioProps {
  classItemId: string;
  /** Where the app-bar back link lands (the owning course's overview). */
  backHref?: string;
  title: string;
  videoUrl: string | null;
  videoDurationSeconds: number | null;
  /** Watch part: scored sections synced to the demo video. */
  initialSections: ClassItemScoreSection[];
  /** Exercise part: the single graded score; null when not yet created. */
  scoreDocumentId: string | null;
  initialScore: ScoreDocument | null;
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
  /** Exercise play-part media (optional cropped video + backing tracks). */
  initialExerciseMedia: ExerciseMedia | null;
  /** Bound server actions (see module note) used to refresh a part on switch. */
  fetchSections: () => Promise<{ data?: ClassItemScoreSection[]; error?: string }>;
  fetchExercise: () => Promise<{ data?: ClassItemScorePayload; error?: string }>;
  fetchExerciseMedia: () => Promise<{ data?: ExerciseMedia; error?: string }>;
}

export function ExerciseStudio({
  classItemId,
  backHref,
  title,
  videoUrl,
  videoDurationSeconds,
  initialSections,
  scoreDocumentId,
  initialScore,
  activeTimeMap,
  initialExerciseMedia,
  fetchSections,
  fetchExercise,
  fetchExerciseMedia,
}: ExerciseStudioProps) {
  // Default to the graded score — it's the item's reason to exist, and the
  // setup/replace flows (which remount this component) land there too.
  const [part, setPart] = useState<Part>('exercise');
  const [isSwitching, startSwitch] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [sections, setSections] = useState(initialSections);
  const [exercisePayload, setExercisePayload] = useState<ExercisePayload | null>(
    scoreDocumentId && initialScore ? { scoreDocumentId, initialScore, activeTimeMap } : null
  );
  const [exerciseMedia, setExerciseMedia] = useState(initialExerciseMedia);
  // Bump on every refetch so the remounting workspace reseeds from fresh data.
  const [switchCount, setSwitchCount] = useState(0);

  const switchPart = (next: Part) => {
    if (next === part || isSwitching) return;
    setError(null);
    startSwitch(async () => {
      if (next === 'watch') {
        // No video yet → the Watch part renders the upload screen; nothing to fetch.
        if (videoUrl) {
          const res = await fetchSections();
          if (res.error || !res.data) {
            setError(res.error ?? 'Failed to load the watch sections.');
            return;
          }
          setSections(res.data);
        }
      } else {
        // "No score document attached" just means StudioSetup should render.
        // The media panel seeds from props on mount, so refresh it alongside.
        const [res, mediaRes] = await Promise.all([fetchExercise(), fetchExerciseMedia()]);
        setExercisePayload(
          res.data
            ? {
                scoreDocumentId: res.data.scoreDocument.id,
                initialScore: res.data.scoreDocument.parsedScore,
                activeTimeMap: res.data.activeTimeMap,
              }
            : null
        );
        if (mediaRes.data) setExerciseMedia(mediaRes.data);
      }
      setSwitchCount((c) => c + 1);
      setPart(next);
    });
  };

  const toggle = (
    <div className="flex items-center gap-2">
      <div className="st-seg" role="radiogroup" aria-label="Exercise part">
        <button
          type="button"
          className={part === 'watch' ? 'is-on' : ''}
          role="radio"
          aria-checked={part === 'watch'}
          onClick={() => switchPart('watch')}
          title={
            videoUrl
              ? 'Watch part — sync scored sections to the demo video'
              : 'Watch part — upload the demo video, then sync scored sections to it'
          }
        >
          <MonitorPlay className="h-3.5 w-3.5" />
          Watch
        </button>
        <button
          type="button"
          className={part === 'exercise' ? 'is-on' : ''}
          role="radio"
          aria-checked={part === 'exercise'}
          onClick={() => switchPart('exercise')}
          title="Exercise part — the graded score students play on the rhythm highway"
        >
          <Target className="h-3.5 w-3.5" />
          Exercise
        </button>
      </div>
      {isSwitching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );

  if (part === 'watch') {
    if (!videoUrl) {
      // No demo video yet — upload it here; router.refresh() re-enters with it.
      return (
        <WatchVideoSetup classItemId={classItemId} classItemTitle={title} appBarExtra={toggle} />
      );
    }
    return (
      <VideoSectionsWorkspace
        key={`watch-${switchCount}`}
        classItemId={classItemId}
        backHref={backHref}
        title={title}
        videoUrl={videoUrl}
        videoDurationSeconds={videoDurationSeconds}
        initialSections={sections}
        appBarExtra={toggle}
      />
    );
  }

  if (!exercisePayload) {
    return (
      <StudioSetup
        classItemId={classItemId}
        classItemTitle={title}
        backHref={backHref}
        appBarExtra={toggle}
      />
    );
  }

  return (
    <StudioWorkspace
      key={`exercise-${switchCount}-${exercisePayload.scoreDocumentId}`}
      owner={{ kind: 'classItem', classItemId }}
      backHref={backHref}
      mode="exercise"
      title={title}
      videoUrl={videoUrl}
      scoreDocumentId={exercisePayload.scoreDocumentId}
      initialScore={exercisePayload.initialScore}
      activeTimeMap={exercisePayload.activeTimeMap}
      videoDurationSeconds={videoDurationSeconds}
      appBarExtra={toggle}
      exerciseMedia={exerciseMedia}
    />
  );
}
