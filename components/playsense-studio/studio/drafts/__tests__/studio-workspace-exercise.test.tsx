// @vitest-environment jsdom
//
// Fix round 1, items 1/3/4: exercise-mode video changes must reach the draft
// (autosave), the exercise owner's draft label must read "Exercise" (not the
// class item title), and the score-stage SyncPanel must not seed its markers
// from the play-along map. SyncPanel and the other heavy leaves are stubbed
// out entirely (their own behavior is covered elsewhere) so this test can
// drive StudioWorkspace's prop-wiring directly.
import React, { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));

const stub = vi.hoisted(() => ({
  syncPanelCalls: [] as Array<{ activeTimeMap: unknown; mode: string; props: Record<string, unknown> }>,
  previewCalls: [] as Array<Record<string, unknown>>,
}));
vi.mock('@/components/playsense-studio/studio/sync-panel', () => ({
  SyncPanel: (props: { activeTimeMap: unknown; mode: string }) => {
    stub.syncPanelCalls.push({ activeTimeMap: props.activeTimeMap, mode: props.mode, props });
    return null;
  },
}));
vi.mock('@/components/playsense-studio/studio/exercise-media-panel', () => ({
  ExerciseMediaPanel: (props: { onVideoChange: (url: string | null) => void }) => (
    <button type="button" onClick={() => props.onVideoChange(null)}>
      remove video
    </button>
  ),
}));
vi.mock('@/components/playsense-studio/studio/backing-lanes-panel', () => ({ BackingLanesPanel: () => null }));
vi.mock('@/components/playsense-studio/studio/highway-preview', () => ({ HighwayPreview: () => null }));
vi.mock('@/components/playsense-studio/studio/score-import-dialog', () => ({ ScoreImportDialog: () => null }));
vi.mock('@/components/playsense-studio/studio/shell/floating-video', () => ({ FloatingVideo: () => null }));
vi.mock('@/components/playsense-studio/studio/student-preview-dialog', () => ({
  StudentPreviewDialog: (props: Record<string, unknown>) => {
    stub.previewCalls.push(props);
    return null;
  },
}));

const acts = vi.hoisted(() => ({ saveStudioDraft: vi.fn() }));
vi.mock('@/app/actions/studio-drafts', () => acts);

import { StudioWorkspace } from '@/app/admin/playsense-studio/[classItemId]/studio-workspace';
import { StudioDraftsProvider, useStudioDrafts, type StudioDraftsValue } from '@/components/playsense-studio/studio/drafts/drafts-context';
import { EMPTY_TIMING, type StudioTiming } from '@/lib/playsense-studio/drafts/timing';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import type { ExerciseMedia } from '@/app/actions/playsense-studio';
import type { PlaysenseStudioPlayerTimeMap } from '@/components/playsense-studio/player/playsense-studio-player';

const SCORE: ScoreDocument = {
  schemaVersion: 1,
  title: 'Graded',
  sourceFormat: 'native',
  initialTempo: 96,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [],
};

const wp = (qn: number, s: number) => ({ musicalPositionQN: qn, videoTimeSeconds: s, measureNumber: null, beatInMeasure: null });

const exerciseMedia: ExerciseMedia = {
  videoUrl: 'https://example.com/play-along.mp4',
  videoStartSeconds: 0,
  videoTrimOutSeconds: null,
  metronomeAnchorSeconds: 1.5,
  metronomeAnchorQn: 0,
  timeMap: { id: 'ex-map', method: 'drag', waypoints: [wp(0, 0.5), wp(4, 2.5)], nudges: [] },
  backingTracks: [],
  play: { bar1Seconds: null, countInBars: 1, preroll: true },
};

let host: HTMLDivElement;
let root: Root;
let ctx: StudioDraftsValue;

function Probe() {
  const value = useStudioDrafts();
  useLayoutEffect(() => {
    ctx = value;
  }, [value]);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  stub.syncPanelCalls = [];
  stub.previewCalls = [];
  acts.saveStudioDraft.mockReset();
  acts.saveStudioDraft.mockResolvedValue({ updatedAt: '2026-01-01T00:00:00.000Z' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

describe('StudioWorkspace — exercise mode (fix round 1)', () => {
  it('labels the owner "Exercise" and seeds the score-stage SyncPanel from the plain activeTimeMap, not the play-along map', () => {
    const rawActiveTimeMap: PlaysenseStudioPlayerTimeMap = { id: 'raw-map', method: 'tempo', waypoints: [] };
    act(() => {
      root.render(
        <StudioDraftsProvider owners={[]}>
          <Probe />
          <StudioWorkspace
            owner={{ kind: 'classItem', classItemId: 'ci-1' }}
            mode="exercise"
            title="Clave 101"
            videoUrl={null}
            scoreDocumentId="doc-1"
            initialScore={SCORE}
            activeTimeMap={rawActiveTimeMap}
            videoDurationSeconds={null}
            exerciseMedia={exerciseMedia}
          />
        </StudioDraftsProvider>
      );
    });

    // (3) Label: "Exercise", not the class item title.
    expect(ctx.statuses['exercise:ci-1']?.label).toBe('Exercise');

    // (4) The score-stage SyncPanel gets the plain activeTimeMap prop
    // unchanged — not a seed derived from the play-along media's time map.
    expect(stub.syncPanelCalls.at(-1)?.activeTimeMap).toBe(rawActiveTimeMap);
  });

  it('reaches the draft (autosaves) when the play-along video is removed', async () => {
    act(() => {
      root.render(
        <StudioDraftsProvider owners={[]}>
          <StudioWorkspace
            owner={{ kind: 'classItem', classItemId: 'ci-1' }}
            mode="exercise"
            title="Clave 101"
            videoUrl={null}
            scoreDocumentId="doc-1"
            initialScore={SCORE}
            activeTimeMap={null}
            videoDurationSeconds={null}
            exerciseMedia={exerciseMedia}
          />
        </StudioDraftsProvider>
      );
    });

    // (1) Removing the play-along video must reach the draft: it autosaves
    // the reset timing (setTiming, not replaceTiming, which would leave the
    // change clean and never autosave it). setTiming merges its patch onto
    // the existing draft timing, so the seeded play-along settings (Studio
    // rework P5) survive the reset; the graded seed no longer carries an
    // anchor (bar 1 replaces it), so the reset anchor is null, not the
    // media's old metronomeAnchorSeconds.
    const btn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'remove video')!;
    act(() => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(acts.saveStudioDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        owner: { kind: 'exercise', id: 'ci-1' },
        timing: { ...EMPTY_TIMING, play: exerciseMedia.play },
      })
    );
  });

  it('the Sync video stage is the graded SyncPanel, wired to the draft play settings (Studio rework P5)', async () => {
    act(() => {
      root.render(
        <StudioDraftsProvider owners={[]}>
          <StudioWorkspace
            owner={{ kind: 'classItem', classItemId: 'ci-1' }}
            mode="exercise"
            title="Clave 101"
            videoUrl={null}
            scoreDocumentId="doc-1"
            initialScore={SCORE}
            activeTimeMap={null}
            videoDurationSeconds={null}
            exerciseMedia={{ ...exerciseMedia, play: { bar1Seconds: 2.5, countInBars: 2, preroll: false } }}
          />
        </StudioDraftsProvider>
      );
    });
    const sync = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Sync video'))!;
    act(() => {
      sync.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const last = stub.syncPanelCalls.at(-1)!;
    expect(last.mode).toBe('graded');
    // The legacy exercise map on the media is never a seed here.
    expect(last.activeTimeMap).toBeNull();
    expect(last.props.initialMetronomeAnchorSeconds).toBeNull();
    expect(last.props.play).toEqual({ bar1Seconds: 2.5, countInBars: 2, preroll: false });
    expect(last.props.gradedOnsets).toEqual([]);

    act(() => {
      (last.props.onPlayChange as (p: object) => void)({ bar1Seconds: 3 });
    });
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });
    expect(acts.saveStudioDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        timing: expect.objectContaining({ play: { bar1Seconds: 3, countInBars: 2, preroll: false } }),
      })
    );
  });

  it('non-exercise modes keep the class item title as the label and seed the SyncPanel from the draft-aware seed', () => {
    const liveMap: PlaysenseStudioPlayerTimeMap = { id: 'live-map', method: 'drag', waypoints: [wp(0, 0), wp(4, 2)] };
    act(() => {
      root.render(
        <StudioDraftsProvider owners={[]}>
          <Probe />
          <StudioWorkspace
            owner={{ kind: 'classItem', classItemId: 'ci-2' }}
            mode="video"
            title="Legacy lesson"
            videoUrl="https://example.com/lesson.mp4"
            scoreDocumentId="doc-2"
            initialScore={SCORE}
            activeTimeMap={liveMap}
            videoDurationSeconds={120}
          />
        </StudioDraftsProvider>
      );
    });

    expect(ctx.statuses['exercise:ci-2']?.label).toBe('Legacy lesson');
    // Went through workspaceSeed → timingToTimeMap, not the raw prop.
    expect(stub.syncPanelCalls.at(-1)?.activeTimeMap).toEqual({
      id: 'draft',
      method: 'drag',
      waypoints: [wp(0, 0), wp(4, 2)],
      nudges: [],
      flex: [],
    });
  });

  it('after a restore/discard adopt, the remounted SyncPanel seeds from the adopted timing, not the old seed', () => {
    const liveMap: PlaysenseStudioPlayerTimeMap = { id: 'live-map', method: 'drag', waypoints: [wp(0, 0), wp(4, 2)] };
    act(() => {
      root.render(
        <StudioDraftsProvider owners={[]}>
          <Probe />
          <StudioWorkspace
            owner={{ kind: 'classItem', classItemId: 'ci-2' }}
            mode="video"
            title="Legacy lesson"
            videoUrl="https://example.com/lesson.mp4"
            scoreDocumentId="doc-2"
            initialScore={SCORE}
            activeTimeMap={liveMap}
            videoDurationSeconds={120}
          />
        </StudioDraftsProvider>
      );
    });

    const restored: StudioTiming = { method: 'drag', params: { nudges: [] }, waypoints: [wp(0, 5), wp(4, 9)], anchor: null };
    act(() => {
      ctx.notifyAdopt('exercise:ci-2', { score: SCORE, timing: restored });
    });

    expect(stub.syncPanelCalls.at(-1)?.activeTimeMap).toEqual({
      id: 'draft',
      method: 'drag',
      waypoints: [wp(0, 5), wp(4, 9)],
      nudges: [],
      flex: [],
    });
  });
});

describe('StudioWorkspace — Student preview and copy notes (Studio rework P5, Task 7)', () => {
  const SCORE_WITH_NOTES: ScoreDocument = {
    ...SCORE,
    title: 'Graded',
    tracks: [
      {
        index: 0,
        instrument: 'perc-conga',
        displayName: 'Conga',
        tuning: null,
        stringMultiplicity: 1,
        channel: null,
        defaultView: 'rhythm-grid',
        measures: [{ number: 1, voices: [{ number: 1, events: [{ kind: 'note', id: 'x', midi: 60, durationQN: 4 }] }] }],
      },
    ],
  };
  const SECTION_SCORE: ScoreDocument = {
    ...SCORE,
    title: 'Verse A',
    tracks: [
      {
        index: 0,
        instrument: 'perc-conga',
        displayName: 'Conga',
        tuning: null,
        stringMultiplicity: 1,
        channel: null,
        defaultView: 'rhythm-grid',
        measures: [{ number: 1, voices: [{ number: 1, events: [{ kind: 'note', id: 'a', midi: 62, durationQN: 4 }] }] }],
      },
    ],
  };

  it('the Student preview chip opens the dialog fed the draft exercise, score, media and play settings', () => {
    act(() => {
      root.render(
        <StudioDraftsProvider owners={[]}>
          <StudioWorkspace
            owner={{ kind: 'classItem', classItemId: 'ci-1' }}
            mode="exercise"
            title="Clave 101"
            videoUrl={null}
            scoreDocumentId="doc-1"
            initialScore={SCORE_WITH_NOTES}
            activeTimeMap={null}
            videoDurationSeconds={null}
            exerciseMedia={exerciseMedia}
          />
        </StudioDraftsProvider>
      );
    });

    expect(stub.previewCalls).toHaveLength(0);
    const btn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.includes('Student preview'))!;
    act(() => {
      btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(stub.previewCalls).toHaveLength(1);
    const call = stub.previewCalls[0];
    expect(call.score).toEqual(SCORE_WITH_NOTES);
    expect(call.play).toEqual(exerciseMedia.play);
    expect(call.exerciseVideo).toEqual({
      url: exerciseMedia.videoUrl,
      startSeconds: exerciseMedia.videoStartSeconds,
      trimOutSeconds: exerciseMedia.videoTrimOutSeconds,
      timeMap: null,
    });
    expect(call.backingTracks).toBe(exerciseMedia.backingTracks);
    expect((call.exercise as { title: string }).title).toBe('Graded');
  });

  it("lists the Watch sections under \"Copy notes from a Watch section\" and applies a confirmed pick as an undoable structural edit", () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    act(() => {
      root.render(
        <StudioDraftsProvider owners={[]}>
          <StudioWorkspace
            owner={{ kind: 'classItem', classItemId: 'ci-1' }}
            mode="exercise"
            title="Clave 101"
            videoUrl={null}
            scoreDocumentId="doc-1"
            initialScore={SCORE_WITH_NOTES}
            activeTimeMap={null}
            videoDurationSeconds={null}
            exerciseMedia={exerciseMedia}
            copySources={[{ id: 'sec-1', title: 'Verse A', score: SECTION_SCORE }]}
          />
        </StudioDraftsProvider>
      );
    });

    const menuBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy notes from a Watch section')
    )!;
    expect(menuBtn.hasAttribute('disabled')).toBe(false);
    act(() => {
      menuBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const sectionItem = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Verse A')!;
    expect(sectionItem).toBeTruthy();
    act(() => {
      sectionItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(confirmSpy).toHaveBeenCalledWith('Replace the exercise notes with "Verse A"? You can undo this.');
    // The score-stage SyncPanel gets the new, spliced-in score: the target's
    // own title stays, the source's single note (a fresh id, midi 62) replaces
    // the target's track-0 notation.
    const last = stub.syncPanelCalls.at(-1)!;
    const nextScore = last.props.score as ScoreDocument;
    expect(nextScore.title).toBe('Graded');
    const events = nextScore.tracks[0].measures[0].voices[0].events;
    expect(events).toHaveLength(1);
    expect(events[0].id).not.toBe('a');
    expect((events[0] as { midi: number }).midi).toBe(62);

    confirmSpy.mockRestore();
  });

  it('does not apply the copy when the confirm is declined', () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
    act(() => {
      root.render(
        <StudioDraftsProvider owners={[]}>
          <StudioWorkspace
            owner={{ kind: 'classItem', classItemId: 'ci-1' }}
            mode="exercise"
            title="Clave 101"
            videoUrl={null}
            scoreDocumentId="doc-1"
            initialScore={SCORE_WITH_NOTES}
            activeTimeMap={null}
            videoDurationSeconds={null}
            exerciseMedia={exerciseMedia}
            copySources={[{ id: 'sec-1', title: 'Verse A', score: SECTION_SCORE }]}
          />
        </StudioDraftsProvider>
      );
    });

    const menuBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy notes from a Watch section')
    )!;
    act(() => {
      menuBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const sectionItem = Array.from(host.querySelectorAll('button')).find((b) => b.textContent === 'Verse A')!;
    act(() => {
      sectionItem.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const last = stub.syncPanelCalls.at(-1)!;
    expect(last.props.score).toEqual(SCORE_WITH_NOTES);
    confirmSpy.mockRestore();
  });

  it('disables the copy-notes menu when there are no Watch sections yet', () => {
    act(() => {
      root.render(
        <StudioDraftsProvider owners={[]}>
          <StudioWorkspace
            owner={{ kind: 'classItem', classItemId: 'ci-1' }}
            mode="exercise"
            title="Clave 101"
            videoUrl={null}
            scoreDocumentId="doc-1"
            initialScore={SCORE_WITH_NOTES}
            activeTimeMap={null}
            videoDurationSeconds={null}
            exerciseMedia={exerciseMedia}
          />
        </StudioDraftsProvider>
      );
    });
    const menuBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      b.textContent?.includes('Copy notes from a Watch section')
    )!;
    expect(menuBtn.hasAttribute('disabled')).toBe(true);
  });
});
