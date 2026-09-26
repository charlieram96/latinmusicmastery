// @vitest-environment jsdom
import { act, useEffect, useMemo, useRef, useState } from 'react';
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

  it('enabled=false writes userSpeed once (never a stale segment rate), then never loops or drives it again (Task 4)', () => {
    const video = new FakeVideo();
    video.paused = false;
    video.currentTime = 11;
    // userSpeed (0.5) deliberately differs from the video's default rate (1)
    // so the one-time write fix round 1 adds is actually observable here.
    mount(video, THREE_POINT, 0.5, false);
    expect(video.playbackRate).toBeCloseTo(0.5);
    expect(video.rateWrites).toBe(1);
    expect(video.preservesPitch).toBe(false);
    expect(queue.size).toBe(0);

    // A play event is exactly the case a caller's own pre-existing rate
    // wiring (e.g. clock.setPlaybackRate) must not get fought on: no
    // listener is attached at all while disabled, so this does nothing.
    act(() => video.dispatchEvent(new Event('play')));
    frame();
    expect(video.rateWrites).toBe(1);
    expect(queue.size).toBe(0);

    // userSpeed changing while still disabled isn't this hook's job to
    // react to — the caller's own rate wiring is what applies it directly
    // on this path (see playsense-studio-player.tsx's identity branch).
    update(video, THREE_POINT, 2, false);
    expect(video.rateWrites).toBe(1);
    expect(video.playbackRate).toBeCloseTo(0.5);
  });

  it('fix round 1: enabled → disabled resets a mid-segment rate to userSpeed, not the last segment rate', () => {
    const video = new FakeVideo();
    video.paused = false;
    video.currentTime = 11; // THREE_POINT's segment rate here is 0.8
    mount(video, THREE_POINT, 0.75);
    frame();
    expect(video.playbackRate).toBeCloseTo(0.6); // 0.75 * 0.8

    // The driver disables — e.g. the player crossed from a flexed section
    // back into an unflexed one, at the same userSpeed.
    update(video, THREE_POINT, 0.75, false);
    expect(video.playbackRate).toBeCloseTo(0.75); // userSpeed, not the stale 0.6
    expect(queue.size).toBe(0); // no loop left running
  });

  it('fix round 1: disabled → enabled picks the segment rate back up, not just userSpeed', () => {
    const video = new FakeVideo();
    video.paused = false;
    video.currentTime = 11;
    mount(video, THREE_POINT, 0.75, false); // disabled: left at userSpeed by the one-time write
    expect(video.playbackRate).toBeCloseTo(0.75);

    // The driver enables — e.g. the player crossed into a flexed section.
    update(video, THREE_POINT, 0.75); // enabled defaults to true
    frame();
    expect(video.playbackRate).toBeCloseTo(0.6); // 0.75 * the segment rate, not just 0.75
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

// A fake video that also fires a native-like 'ratechange' event whenever
// playbackRate is set (the HTML spec queues one whenever the IDL attribute is
// set; FakeVideo above deliberately doesn't, since the hook itself never
// listens for it). The harness below needs it to mimic
// useVideoTransportClock's own ratechange-driven playbackRate state, which is
// exactly what fix round 1's issue #2 is about: a stale write from this hook
// re-triggers that listener in the real player, so the transport itself would
// keep showing the stale value without the fix.
class NotifyingFakeVideo extends EventTarget {
  currentTime = 0;
  paused = true;
  preservesPitch = false;
  private _rate = 1;
  get playbackRate() { return this._rate; }
  set playbackRate(v: number) {
    this._rate = v;
    this.dispatchEvent(new Event('ratechange'));
  }
}

// Module-level, taking `video` as a plain parameter rather than a value
// closed over from a component prop — same reasoning as
// use-flex-playback.ts's resetToUserSpeed: the repo's React Compiler lint
// rule flags mutating a captured prop/state value directly.
function setVideoRate(video: NotifyingFakeVideo, rate: number) {
  video.playbackRate = rate;
}

describe('player speed handoff across a flex boundary (fix round 1, issues #1 + #2)', () => {
  // Mirrors playsense-studio-player.tsx's own wiring: a flexMap derived from
  // the active section, a userSpeed state the flexed path owns, and a
  // displayedRate/onDisplayedRateChange pair where the identity branch writes
  // BOTH the (simulated) clock and userSpeed together — the fix for issue #1
  // — plus a `clockRate` state kept in sync from the video's own 'ratechange'
  // event, exactly like useVideoTransportClock, so a stale write left behind
  // by useFlexPlayback disabling (issue #2) is visible here exactly as it
  // would be in the real transport.
  function Harness({
    video,
    points,
    onExpose,
  }: {
    video: NotifyingFakeVideo;
    points: FlexPoint[] | null;
    onExpose: (api: { displayedRate: number; setDisplayedRate: (r: number) => void }) => void;
  }) {
    const videoRef = useRef<HTMLVideoElement | null>(video as unknown as HTMLVideoElement);
    const flexMap = useMemo(() => new FlexMap(points ?? []), [points]);
    const [userSpeed, setUserSpeed] = useState(1);
    const [clockRate, setClockRate] = useState(1);
    useFlexPlayback(videoRef, flexMap, userSpeed, !flexMap.isIdentity);
    useEffect(() => {
      const onRateChange = () => setClockRate(video.playbackRate);
      video.addEventListener('ratechange', onRateChange);
      return () => video.removeEventListener('ratechange', onRateChange);
    }, [video]);
    const displayedRate = flexMap.isIdentity ? clockRate : userSpeed;
    const onDisplayedRateChange = flexMap.isIdentity
      ? (r: number) => {
          setVideoRate(video, r); // all clock.setPlaybackRate does to the element
          setUserSpeed(r);
        }
      : setUserSpeed;
    onExpose({ displayedRate, setDisplayedRate: onDisplayedRateChange });
    return null;
  }

  it("keeps the student's speed across unflexed → flexed → unflexed, with no stale segment rate left behind", () => {
    const video = new NotifyingFakeVideo();
    video.paused = false;
    video.currentTime = 11; // THREE_POINT's segment rate here is 0.8
    let api = { displayedRate: 1, setDisplayedRate: (r: number) => { void r; } };
    const expose = (a: typeof api) => { api = a; };

    // Unflexed: the student sets 0.75x through the transport.
    act(() => root.render(<Harness video={video} points={null} onExpose={expose} />));
    act(() => api.setDisplayedRate(0.75));
    expect(api.displayedRate).toBeCloseTo(0.75);
    expect(video.playbackRate).toBeCloseTo(0.75);

    // Crosses into a flexed section: userSpeed carries across (issue #1),
    // not reset to the initial 1.
    act(() => root.render(<Harness video={video} points={THREE_POINT.points} onExpose={expose} />));
    expect(api.displayedRate).toBeCloseTo(0.75);
    frame();
    expect(video.playbackRate).toBeCloseTo(0.6); // 0.75 * 0.8

    // Crosses back out to unflexed: no stale 0.6 left on the element or
    // shown in the (simulated) transport (issue #2).
    act(() => root.render(<Harness video={video} points={null} onExpose={expose} />));
    expect(video.playbackRate).toBeCloseTo(0.75);
    expect(api.displayedRate).toBeCloseTo(0.75);
  });
});
