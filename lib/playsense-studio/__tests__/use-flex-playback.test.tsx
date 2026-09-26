// @vitest-environment jsdom
import { act, useRef } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FlexMap, type FlexPoint } from '../flex';
import { flexElementRate, useFlexPlayback } from '../use-flex-playback';

const p = (src: number, dst: number): FlexPoint => ({ src, dst, anchor: false });
const THREE_POINT = new FlexMap([p(10, 10), p(12, 12.5), p(14, 14)]);
const IDENTITY = new FlexMap([]);

// A hand-driven requestAnimationFrame: frames run only when a test flushes one.
let queue = new Map<number, FrameRequestCallback>();
let nextId = 1;
let clock = 0;
function frame(ms = 16) {
  clock += ms;
  const due = queue;
  queue = new Map();
  act(() => due.forEach((cb) => cb(clock)));
}

// Fake video: a plain EventTarget (as the hook only ever adds/removes 'play'
// and 'pause' listeners), with a getter/setter on playbackRate so tests can
// count writes directly instead of inferring them from behaviour.
class FakeVideo extends EventTarget {
  currentTime = 0;
  paused = true;
  preservesPitch = false;
  rateWrites = 0;
  private _rate = 1;
  get playbackRate() { return this._rate; }
  set playbackRate(v: number) { this.rateWrites++; this._rate = v; }
}

let root: Root;
let host: HTMLDivElement;

function Harness({
  video,
  map,
  userSpeed,
  enabled,
}: {
  video: FakeVideo;
  map: FlexMap;
  userSpeed: number;
  enabled?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(video as unknown as HTMLVideoElement);
  useFlexPlayback(videoRef, map, userSpeed, enabled);
  return null;
}

function mount(video: FakeVideo, map: FlexMap, userSpeed: number, enabled?: boolean) {
  act(() => root.render(<Harness video={video} map={map} userSpeed={userSpeed} enabled={enabled} />));
}
function update(video: FakeVideo, map: FlexMap, userSpeed: number, enabled?: boolean) {
  act(() => root.render(<Harness video={video} map={map} userSpeed={userSpeed} enabled={enabled} />));
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  queue = new Map();
  clock = 0;
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextId++;
    queue.set(id, cb);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    queue.delete(id);
  });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.unstubAllGlobals();
});

describe('flexElementRate', () => {
  it('is userSpeed with no flex points', () => {
    expect(flexElementRate(IDENTITY, 5, 0.75)).toBeCloseTo(0.75);
  });
  it('multiplies userSpeed by the segment rate', () => {
    expect(flexElementRate(THREE_POINT, 11, 1)).toBeCloseTo(0.8);
    expect(flexElementRate(THREE_POINT, 11, 0.75)).toBeCloseTo(0.6);
  });
  it('at 0.75x with a 110% segment gives 0.825 (Review Focus #2)', () => {
    const map = new FlexMap([p(0, 0), p(11, 10)]); // Δsrc/Δdst = 1.1
    expect(flexElementRate(map, 5, 0.75)).toBeCloseTo(0.825);
  });
  it('clamps the product to [0.25, 4]', () => {
    const fast = new FlexMap([p(0, 0), p(11, 10)]); // segment rate 1.1
    expect(flexElementRate(fast, 5, 4)).toBe(4);
    const slow = new FlexMap([p(0, 0), p(5, 10)]); // segment rate 0.5 (already clamped)
    expect(flexElementRate(slow, 2, 0.1)).toBe(0.25);
  });
});

describe('useFlexPlayback', () => {
  it('drives playbackRate per frame while playing, across a segment boundary, then stops and resumes on pause/play', () => {
    const video = new FakeVideo();
    video.paused = false;
    video.currentTime = 11;
    mount(video, THREE_POINT, 1);

    frame();
    expect(video.playbackRate).toBeCloseTo(0.8);
    expect(video.preservesPitch).toBe(true);

    video.currentTime = 13;
    frame();
    expect(video.playbackRate).toBeCloseTo(4 / 3); // ≈1.333

    act(() => { video.paused = true; video.dispatchEvent(new Event('pause')); });
    expect(queue.size).toBe(0); // the loop is cancelled, nothing left to flush
    const rateAtPause = video.playbackRate;
    video.currentTime = 11; // would change the rate if the loop were still running
    frame();
    expect(video.playbackRate).toBe(rateAtPause);

    act(() => { video.paused = false; video.dispatchEvent(new Event('play')); });
    frame();
    expect(video.playbackRate).toBeCloseTo(0.8); // back at media 11
  });

  it('writes preservesPitch/webkitPreservesPitch only when the map is not identity', () => {
    const video = new FakeVideo();
    (video as unknown as { webkitPreservesPitch: boolean }).webkitPreservesPitch = false;
    video.paused = false;
    video.currentTime = 11;
    mount(video, THREE_POINT, 1);
    frame();
    expect(video.preservesPitch).toBe(true);
    expect((video as unknown as { webkitPreservesPitch: boolean }).webkitPreservesPitch).toBe(true);
  });

  it('writes mozPreservesPitch too, when the property exists', () => {
    const video = new FakeVideo();
    (video as unknown as { mozPreservesPitch: boolean }).mozPreservesPitch = false;
    video.paused = false;
    video.currentTime = 11;
    mount(video, THREE_POINT, 1);
    frame();
    expect(video.preservesPitch).toBe(true);
    expect((video as unknown as { mozPreservesPitch: boolean }).mozPreservesPitch).toBe(true);
  });

  it('resets preservesPitch (and the vendor variants) back to false when the map returns to identity', () => {
    const video = new FakeVideo();
    (video as unknown as { webkitPreservesPitch: boolean }).webkitPreservesPitch = false;
    (video as unknown as { mozPreservesPitch: boolean }).mozPreservesPitch = false;
    video.paused = false;
    video.currentTime = 11;
    mount(video, THREE_POINT, 1);
    frame();
    expect(video.preservesPitch).toBe(true);
    expect((video as unknown as { webkitPreservesPitch: boolean }).webkitPreservesPitch).toBe(true);

    update(video, IDENTITY, 1);
    expect(video.preservesPitch).toBe(false);
    expect((video as unknown as { webkitPreservesPitch: boolean }).webkitPreservesPitch).toBe(false);
    expect((video as unknown as { mozPreservesPitch: boolean }).mozPreservesPitch).toBe(false);
    expect(video.playbackRate).toBeCloseTo(1); // userSpeed, once, no loop
    expect(queue.size).toBe(0);
  });

  it('starts driving the rate when flex turns on mid-playback (identity → non-identity while playing)', () => {
    const video = new FakeVideo();
    video.paused = false;
    video.currentTime = 11;
    mount(video, IDENTITY, 0.75);
    expect(video.playbackRate).toBeCloseTo(0.75);
    expect(queue.size).toBe(0); // no loop yet: still identity

    update(video, THREE_POINT, 1);
    expect(video.preservesPitch).toBe(true);
    expect(queue.size).toBeGreaterThan(0); // the loop picked up immediately, without a play event
    frame();
    expect(video.playbackRate).toBeCloseTo(0.8); // media 11, computed from the now-active map
  });

  it('writes only when the change exceeds 0.001', () => {
    const video = new FakeVideo();
    video.paused = false;
    video.currentTime = 11; // stays in the same segment across frames: rate never changes
    mount(video, THREE_POINT, 1);
    frame();
    expect(video.rateWrites).toBe(1);
    frame();
    frame();
    expect(video.rateWrites).toBe(1); // no redundant writes once the rate has settled
  });

  it('is a no-op for an identity map: sets rate to userSpeed once and never loops', () => {
    const video = new FakeVideo();
    video.paused = false;
    video.currentTime = 11;
    mount(video, IDENTITY, 0.75);
    expect(video.playbackRate).toBeCloseTo(0.75);
    expect(video.rateWrites).toBe(1);
    expect(video.preservesPitch).toBe(false); // untouched
    expect(queue.size).toBe(0); // no rAF loop was scheduled

    update(video, IDENTITY, 0.5);
    expect(video.playbackRate).toBeCloseTo(0.5);
    expect(queue.size).toBe(0);
  });

  it('enabled=false is a true no-op even with a non-identity map: no writes, no loop, ever (Task 4)', () => {
    const video = new FakeVideo();
    video.paused = false;
    video.currentTime = 11;
    mount(video, THREE_POINT, 1, false);
    expect(video.rateWrites).toBe(0);
    expect(video.preservesPitch).toBe(false);
    expect(queue.size).toBe(0);

    // A play event is exactly the case a caller's own pre-existing rate
    // wiring (e.g. clock.setPlaybackRate) must not get fought on: the
    // identity branch would otherwise reset the rate to userSpeed here.
    act(() => video.dispatchEvent(new Event('play')));
    frame();
    expect(video.rateWrites).toBe(0);
    expect(queue.size).toBe(0);

    update(video, THREE_POINT, 2, false);
    expect(video.rateWrites).toBe(0);
  });

  it('cancels the rAF on unmount', () => {
    const video = new FakeVideo();
    video.paused = false;
    video.currentTime = 11;
    mount(video, THREE_POINT, 1);
    frame();
    expect(queue.size).toBeGreaterThan(0);
    act(() => root.unmount());
    expect(queue.size).toBe(0);
    root = createRoot(host); // afterEach unmounts again
  });

  it('picks up a video that attaches on a later render (e.g. portalled into a floating PiP)', () => {
    // A plain mutable object standing in for a ref whose .current is set
    // imperatively by a real DOM ref callback that only fires once the
    // portal target exists — not through useRef's one-time initial value.
    const lateRef: { current: HTMLVideoElement | null } = { current: null };
    function LateHarness({ map, userSpeed }: { map: FlexMap; userSpeed: number }) {
      useFlexPlayback(lateRef, map, userSpeed);
      return null;
    }
    act(() => root.render(<LateHarness map={THREE_POINT} userSpeed={1} />));
    expect(queue.size).toBe(0); // nothing to drive yet

    const video = new FakeVideo();
    video.paused = false;
    video.currentTime = 11;
    lateRef.current = video as unknown as HTMLVideoElement;
    // The owner re-renders (unrelated to this hook's own props) once the
    // portalled <video> exists; the hook's no-dep poll effect picks up the
    // now-attached element from that same commit.
    act(() => root.render(<LateHarness map={THREE_POINT} userSpeed={1} />));

    frame();
    expect(video.playbackRate).toBeCloseTo(0.8);
    expect(video.preservesPitch).toBe(true);
  });
});
