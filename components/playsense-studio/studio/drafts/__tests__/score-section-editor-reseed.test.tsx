// @vitest-environment jsdom
//
// Final review I2: Restore/Discard adopt new timing and bump draft.timingEpoch,
// which remounts SyncPanel. SyncPanel reads its seed props only on mount, so
// they must come from the draft's timing, not the host's mount-time seed —
// otherwise the next drag sends the discarded timing back. SyncPanel is
// stubbed to record the seed props it mounts with.
import React, { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stub = vi.hoisted(() => ({
  calls: [] as Array<{ activeTimeMap: unknown; anchor: unknown }>,
}));
vi.mock('@/components/playsense-studio/studio/sync-panel', () => ({
  SyncPanel: (props: { activeTimeMap: unknown; initialMetronomeAnchorSeconds?: unknown }) => {
    stub.calls.push({ activeTimeMap: props.activeTimeMap, anchor: props.initialMetronomeAnchorSeconds });
    return null;
  },
}));
vi.mock('@/components/playsense-studio/studio/drafts/history-panel', () => ({ HistoryPanel: () => null }));
vi.mock('@/components/playsense-studio/studio/score-meta-editor', () => ({ ScoreMetaEditor: () => null }));
vi.mock('@/components/playsense-studio/studio/highway-preview', () => ({ HighwayPreview: () => null }));
vi.mock('@/components/playsense-studio/studio/score-import-dialog', () => ({ ScoreImportDialog: () => null }));
vi.mock('@/app/actions/playsense-studio', () => ({ replaceSectionScore: vi.fn() }));
const acts = vi.hoisted(() => ({ saveStudioDraft: vi.fn() }));
vi.mock('@/app/actions/studio-drafts', () => acts);

import { ScoreSectionEditor } from '@/components/playsense-studio/studio/score-section-editor';
import { StudioDraftsProvider, useStudioDrafts, type StudioDraftsValue } from '@/components/playsense-studio/studio/drafts/drafts-context';
import type { StudioTiming } from '@/lib/playsense-studio/drafts/timing';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const SCORE: ScoreDocument = {
  schemaVersion: 1,
  title: 'Intro',
  sourceFormat: 'native',
  initialTempo: 96,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [],
};
const wp = (qn: number, s: number) => ({ musicalPositionQN: qn, videoTimeSeconds: s, measureNumber: null, beatInMeasure: null });
const SEED: StudioTiming = { method: 'drag', params: { nudges: [] }, waypoints: [wp(0, 1), wp(4, 3)], anchor: { seconds: 1, qn: 0 } };

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
  stub.calls = [];
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

describe('ScoreSectionEditor — SyncPanel reseed after adopt', () => {
  it('remounts SyncPanel on the adopted timing and anchor, not the mount-time seed', () => {
    act(() => {
      root.render(
        <StudioDraftsProvider owners={[]}>
          <Probe />
          <ScoreSectionEditor
            classItemId="ci-1"
            sectionId="sec-1"
            scoreDocumentId="doc-1"
            initialScore={SCORE}
            initialTiming={SEED}
            classItemTitle="Lesson"
            sectionIndex={0}
            sectionCount={1}
            videoUrl="https://example.com/lesson.mp4"
            videoDurationSeconds={120}
            onChanged={() => {}}
            sections={[]}
            onSelectSection={() => {}}
            appBarEl={null}
            metaEl={null}
            inspectorEl={null}
            transportEl={null}
            monitorEl={null}
            drawerEl={null}
            highwayOpen={false}
          />
        </StudioDraftsProvider>
      );
    });
    expect(stub.calls.at(-1)).toEqual({
      activeTimeMap: { id: 'draft', method: 'drag', waypoints: [wp(0, 1), wp(4, 3)], nudges: [], flex: [] },
      anchor: 1,
    });

    const restored: StudioTiming = { method: 'drag', params: { nudges: [] }, waypoints: [wp(0, 5), wp(4, 9)], anchor: { seconds: 5, qn: 0 } };
    act(() => {
      ctx.notifyAdopt('section:sec-1', { score: SCORE, timing: restored });
    });
    expect(stub.calls.at(-1)).toEqual({
      activeTimeMap: { id: 'draft', method: 'drag', waypoints: [wp(0, 5), wp(4, 9)], nudges: [], flex: [] },
      anchor: 5,
    });
  });
});
