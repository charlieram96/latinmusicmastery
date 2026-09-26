// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BackingTrack } from '@/app/actions/playsense-studio';
import type { TimelineView } from '../sync-panel';

const placement = vi.fn();
vi.mock('@/app/actions/playsense-studio', () => ({
  updateBackingTrackPlacement: (...args: unknown[]) => placement(...args),
  updateBackingTrackDuration: vi.fn(),
  updateBackingTrackGain: vi.fn(),
}));
vi.mock('@/lib/playsense-studio/save-queue', () => ({
  queueStudioSave: (_key: string, fn: () => unknown) => fn(),
}));
vi.mock('@/components/playsense-studio/sync/use-lane-peaks', () => ({
  useLanePeaks: () => ({}),
  lanePeaksEntry: () => ({ status: 'idle', peaks: null, progress: 0 }),
}));
vi.mock('@/components/playsense-studio/player/state/use-backing-mixer', () => ({
  useBackingMixer: () => ({ stopClip: vi.fn() }),
}));
// Capture the lane's callbacks instead of driving a canvas.
type LaneProps = {
  onClipChange: (trackId: string, clip: { timelineStartSeconds: number; trimInSeconds: number; trimOutSeconds: number | null }) => void;
  onClipCommit: (trackId: string, part: string, moved: boolean) => void;
};
let lane: LaneProps | null = null;
vi.mock('@/components/playsense-studio/sync/backing-lanes', () => ({
  LANE_H: 40,
  BackingLanes: (p: LaneProps) => {
    lane = p;
    return null;
  },
}));

import { BackingLanesPanel } from '../backing-lanes-panel';

const TRACK: BackingTrack = {
  id: 't1',
  label: 'Bass',
  audioUrl: 'https://example.test/bass.mp3',
  orderIndex: 0,
  timelineStartSeconds: 0,
  trimInSeconds: 0,
  trimOutSeconds: null,
  sourceDurationSeconds: 30,
  gain: 1,
  positionQn: null,
  timeMapId: null,
};

const VIEW = {
  videoRef: { current: null },
  usableRegion: { startSeconds: 0, endSeconds: 60 },
  pixelsPerSecond: 40,
  scrollLeftPx: 0,
  timelineDurationSeconds: 60,
  viewportWidth: 800,
  snapTimes: [],
  getCurrentSeconds: () => 0,
  isPlaying: false,
  playbackRate: 1,
  onScrollByPx: () => {},
  onZoomBy: () => {},
} as unknown as TimelineView;

describe('BackingLanesPanel position_qn', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.useFakeTimers();
    placement.mockReset();
    lane = null;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
    vi.useRealTimers();
  });

  function moveClipTo(seconds: number) {
    act(() => lane!.onClipChange('t1', { timelineStartSeconds: seconds, trimInSeconds: 0, trimOutSeconds: null }));
    act(() => lane!.onClipCommit('t1', 'body', true));
    act(() => vi.advanceTimersByTime(700));
  }

  it('uses mediaToQN for position_qn when given, with no time map id', () => {
    const mediaToQN = vi.fn((s: number) => (s - 2) * 2);
    act(() =>
      root.render(
        <BackingLanesPanel classItemId="ci" tracks={[TRACK]} timeMap={null} mediaToQN={mediaToQN} view={VIEW} />
      )
    );
    moveClipTo(5);
    expect(mediaToQN).toHaveBeenCalledWith(5);
    expect(placement).toHaveBeenCalledTimes(1);
    expect(placement.mock.calls[0][0]).toMatchObject({ trackId: 't1', timelineStartSeconds: 5, positionQn: 6, timeMapId: null });
  });

  it('falls back to the time map when there is no mediaToQN', () => {
    act(() =>
      root.render(
        <BackingLanesPanel
          classItemId="ci"
          tracks={[TRACK]}
          timeMap={{
            id: 'map-1',
            method: 'drag',
            waypoints: [
              { musicalPositionQN: 0, videoTimeSeconds: 0, measureNumber: 1, beatInMeasure: 1 },
              { musicalPositionQN: 8, videoTimeSeconds: 4, measureNumber: null, beatInMeasure: null },
            ],
          } as never}
          view={VIEW}
        />
      )
    );
    moveClipTo(2);
    expect(placement.mock.calls[0][0]).toMatchObject({ positionQn: 4, timeMapId: 'map-1' });
  });
});
