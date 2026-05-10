'use client';

// Compás sync workspace — admin tool to align notation to video time.
//
// Two modes ship in v1:
//   • Tempo + offset: best for steady-tempo material. Enter BPM and start
//     offset; we generate measure-aligned waypoints across the score.
//   • Tap-along: best for rubato or live recordings. Play the video and
//     spacebar-tap each beat; each tap becomes a waypoint at the next
//     musical beat.
//
// Drag-to-time and MIDI auto-detect are deferred.
//
// The bottom of the page hosts a live read-only player using the candidate
// time map so the admin can hear/see whether the cursor lines up before
// publishing.

import { ArrowLeft, Save } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState, useTransition } from 'react';
import {
  publishTimeMap,
  type CompasSyncMethod,
} from '@/app/actions/compas';
import {
  CompasPlayer,
  type CompasPlayerScoreTrack,
  type CompasPlayerTimeMap,
} from '@/components/compas/player/compas-player';
import { TempoOffsetMode } from './modes/tempo-offset-mode';
import { TapAlongMode } from './modes/tap-along-mode';
import type { ScoreDocument } from '@/components/compas/shared/score-model/types';

export interface CandidateTimeMap {
  method: CompasSyncMethod;
  params: Record<string, unknown>;
  waypoints: CompasPlayerTimeMap['waypoints'];
}

interface SyncWorkspaceProps {
  classItemId: string;
  classItemTitle: string;
  videoUrl: string;
  scoreDocumentId: string;
  score: ScoreDocument;
  tracks: CompasPlayerScoreTrack[];
  activeTimeMap: CompasPlayerTimeMap | null;
}

type Tab = 'tempo' | 'tap';

export function SyncWorkspace({
  classItemId,
  classItemTitle,
  videoUrl,
  scoreDocumentId,
  score,
  tracks,
  activeTimeMap,
}: SyncWorkspaceProps) {
  const [tab, setTab] = useState<Tab>('tempo');
  const [candidate, setCandidate] = useState<CandidateTimeMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [publishedId, setPublishedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The preview player consumes a CompasPlayerTimeMap shape — synthesize
  // one with a stub id so the player accepts it.
  const previewTimeMap: CompasPlayerTimeMap | null = useMemo(() => {
    if (candidate && candidate.waypoints.length >= 2) {
      return {
        id: 'candidate',
        method: candidate.method,
        waypoints: candidate.waypoints,
      };
    }
    return activeTimeMap;
  }, [candidate, activeTimeMap]);

  const handlePublish = () => {
    if (!candidate || candidate.waypoints.length < 2) {
      setError('Build a candidate time map first.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await publishTimeMap({
        classItemId,
        scoreDocumentId,
        method: candidate.method,
        params: candidate.params,
        waypoints: candidate.waypoints,
        makeActive: true,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setPublishedId(result.timeMapId ?? null);
    });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 bg-card border-b border-border px-6 py-3 flex items-center gap-3">
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Admin
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-semibold">Sync — {classItemTitle}</h1>

        <button
          onClick={handlePublish}
          disabled={!candidate || candidate.waypoints.length < 2 || isPending}
          className="ml-auto inline-flex items-center gap-2 px-4 py-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          <Save className="w-4 h-4" />
          {isPending ? 'Publishing…' : 'Publish'}
        </button>
      </header>

      <main className="px-6 py-6 max-w-6xl mx-auto space-y-5">
        {error && (
          <p className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-md px-3 py-2">
            {error}
          </p>
        )}
        {publishedId && (
          <p className="text-sm text-primary bg-primary/10 border border-primary/30 rounded-md px-3 py-2">
            Time map published. Students will see the new sync on this lesson.
          </p>
        )}

        <nav className="flex gap-1 border-b border-border">
          {(
            [
              { id: 'tempo' as const, label: 'Tempo + offset' },
              { id: 'tap' as const, label: 'Tap-along' },
            ] as const
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm border-b-2 -mb-px transition ${
                tab === t.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>

        <section className="bg-card border border-border rounded-lg p-5">
          {tab === 'tempo' && (
            <TempoOffsetMode
              score={score}
              videoUrl={videoUrl}
              onCandidateChange={setCandidate}
            />
          )}
          {tab === 'tap' && (
            <TapAlongMode
              score={score}
              videoUrl={videoUrl}
              onCandidateChange={setCandidate}
            />
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-sm font-medium">Live preview</h3>
          <p className="text-xs text-muted-foreground">
            Plays the video against the candidate sync. If the cursor drifts
            from the audio, refine in the active mode and re-check.
          </p>
          <div className="bg-card border border-border rounded-lg p-4">
            <CompasPlayer
              classItemId={classItemId}
              videoUrl={videoUrl}
              score={score}
              tracks={tracks}
              activeTimeMap={previewTimeMap}
              readOnly
            />
          </div>
        </section>
      </main>
    </div>
  );
}
