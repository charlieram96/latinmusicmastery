import type { ClassItemScorePayload, ClassItemScoreSection } from '@/app/actions/playsense-studio';
import type { StudioDraft } from '@/app/actions/studio-drafts';
import { timingToTimeMap } from './timing';

/** Preview score and timing together; never mix draft BPM with a published map. */
export function previewPayload<T extends ClassItemScorePayload>(live: T, draft?: StudioDraft): T {
  if (!draft) return live;
  return {
    ...live,
    scoreDocument: { ...live.scoreDocument, parsedScore: draft.score, title: draft.score.title, composer: draft.score.composer ?? null },
    tracks: draft.score.tracks.map(track => ({
      id: live.tracks.find(t => t.trackIndex === track.index)?.id ?? `draft-track-${track.index}`,
      trackIndex: track.index, instrument: track.instrument, displayName: track.displayName,
      tuning: track.tuning, stringMultiplicity: track.stringMultiplicity, defaultView: track.defaultView,
    })),
    activeTimeMap: timingToTimeMap(draft.timing),
  };
}

export function previewSection(live: ClassItemScoreSection, draft?: StudioDraft): ClassItemScoreSection {
  if (!draft) return live;
  const times = draft.timing.waypoints.map(w => w.videoTimeSeconds);
  return { ...previewPayload(live, draft),
    videoStartSeconds: times.length >= 2 ? Math.min(...times) : null,
    videoEndSeconds: times.length >= 2 ? Math.max(...times) : null,
    metronomeAnchorSeconds: draft.timing.anchor?.seconds ?? null,
    metronomeAnchorQn: draft.timing.anchor?.qn ?? null,
  };
}
