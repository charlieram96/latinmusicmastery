// @vitest-environment jsdom
import React, { act, useEffect, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MarkerState } from '@/components/playsense-studio/sync/marker-model';
import { useMarkerTween } from '../use-marker-tween';

/** N bars of 4 QN laid at `spb` seconds per beat from `start`. */
function laid(n: number, start: number, spb: number): MarkerState {
  return {
    measures: Array.from({ length: n }, (_, i) => ({
      measureNumber: i + 1, beatsInMeasure: 4, downbeatQN: i * 4, expanded: false, nudges: [],
      onsetQNs: [i * 4],
      beats: [0, 1, 2, 3].map((b) => ({ beatInMeasure: b + 1, musicalPositionQN: i * 4 + b, videoTimeSeconds: start + (i * 4 + b) * spb, edited: false })),
    })),
    tailQN: n * 4,
    tailVideoTimeSeconds: start + n * 4 * spb,
  } as unknown as MarkerState;
}
const FROM = laid(2, 1.0, 0.5);
const TO = laid(2, 2.0, 0.5);
const FOREIGN = laid(2, 7.0, 0.5);

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

type Api = { tween: ReturnType<typeof useMarkerTween>; markers: MarkerState; setMarkers: (m: MarkerState) => void };

function Harness({ onDone, api, onUnmount }: {
  onDone: (m: MarkerState) => void;
  api: { current: Api | null };
  /** Runs from an unmount cleanup declared AFTER the hook, like SyncPanel's flush. */
  onUnmount?: (tween: ReturnType<typeof useMarkerTween>) => void;
}) {
  const [markers, setMarkers] = useState(FROM);
  // Competes with the tween every frame, like the playback clock does.
  const [, setTick] = useState(0);
  useEffect(() => {
    let id = requestAnimationFrame(function loop() {
      setTick((t) => t + 1);
      id = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(id);
  }, []);
  const tween = useMarkerTween({ markers, setMarkers, onDone });
  useEffect(() => {
    api.current = { tween, markers, setMarkers };
  }, [api, tween, markers]);
  const tweenRef = useRef(tween);
  useEffect(() => {
    tweenRef.current = tween;
  });
  useEffect(() => () => onUnmount?.(tweenRef.current), [onUnmount]);
  return <span data-first={markers.measures[0].beats[0].videoTimeSeconds} />;
}

let root: Root;
let host: HTMLDivElement;
const api: { current: Api | null } = { current: null };
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
  api.current = null;
});

function mount(onDone: (m: MarkerState) => void, onUnmount?: (tween: ReturnType<typeof useMarkerTween>) => void) {
  act(() => root.render(<React.StrictMode><Harness onDone={onDone} api={api} onUnmount={onUnmount} /></React.StrictMode>));
}

describe('useMarkerTween', () => {
  it('tweens to the final state through a competing per-frame update and calls onDone once', () => {
    const onDone = vi.fn();
    mount(onDone);
    act(() => api.current!.tween.start(FROM, TO));
    expect(api.current!.tween.running.current).toBe(true);
    expect(api.current!.tween.active).toBe(true); // rendered, so a button can disable itself
    frame();
    frame(100);
    const mid = api.current!.markers.measures[0].beats[0].videoTimeSeconds;
    expect(mid).toBeGreaterThan(1.0);
    expect(mid).toBeLessThan(2.0);
    for (let i = 0; i < 30; i++) frame();
    expect(api.current!.markers).toBe(TO);
    expect(api.current!.tween.running.current).toBe(false);
    expect(api.current!.tween.active).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(TO);
  });

  it('stops when something else writes the markers mid-tween, without calling onDone', () => {
    const onDone = vi.fn();
    mount(onDone);
    act(() => api.current!.tween.start(FROM, TO));
    frame();
    frame(100);
    act(() => api.current!.setMarkers(FOREIGN));
    for (let i = 0; i < 30; i++) frame();
    expect(api.current!.markers).toBe(FOREIGN);
    expect(api.current!.tween.running.current).toBe(false);
    expect(api.current!.tween.active).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('cancel() stops it where it is, without calling onDone', () => {
    const onDone = vi.fn();
    mount(onDone);
    act(() => api.current!.tween.start(FROM, TO));
    frame();
    frame(100);
    const at = api.current!.markers;
    act(() => api.current!.tween.cancel());
    for (let i = 0; i < 30; i++) frame();
    expect(api.current!.markers).toBe(at);
    expect(api.current!.tween.active).toBe(false);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('cancels on unmount', () => {
    const onDone = vi.fn();
    mount(onDone);
    act(() => api.current!.tween.start(FROM, TO));
    frame();
    act(() => root.unmount());
    expect(queue.size).toBe(0);
    for (let i = 0; i < 30; i++) frame();
    expect(onDone).not.toHaveBeenCalled();
    root = createRoot(host); // afterEach unmounts again
  });

  it('finish() lands the final state at once, calls onDone once, and stops the frames', () => {
    const onDone = vi.fn();
    mount(onDone);
    act(() => api.current!.tween.start(FROM, TO));
    frame();
    frame(100);
    expect(api.current!.markers).not.toBe(TO); // mid-tween
    let landed: MarkerState | null = null;
    act(() => { landed = api.current!.tween.finish(); });
    expect(landed).toBe(TO);
    expect(api.current!.markers).toBe(TO);
    expect(api.current!.tween.running.current).toBe(false);
    expect(api.current!.tween.active).toBe(false);
    for (let i = 0; i < 30; i++) frame();
    expect(api.current!.markers).toBe(TO);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(TO);
    // Nothing left to finish.
    act(() => { landed = api.current!.tween.finish(); });
    expect(landed).toBeNull();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('finish() does nothing when idle, after cancel, or after a foreign write', () => {
    const onDone = vi.fn();
    mount(onDone);
    expect(api.current!.tween.finish()).toBeNull();
    act(() => api.current!.tween.start(FROM, TO));
    frame();
    act(() => api.current!.tween.cancel());
    expect(api.current!.tween.finish()).toBeNull();
    act(() => api.current!.tween.start(api.current!.markers, TO));
    frame();
    act(() => api.current!.setMarkers(FOREIGN));
    expect(api.current!.tween.finish()).toBeNull();
    expect(api.current!.markers).toBe(FOREIGN);
    expect(onDone).not.toHaveBeenCalled();
  });

  it('an unmount flush can still finish() a running tween and get the final state', () => {
    const onDone = vi.fn();
    const flushed: Array<MarkerState | null> = [];
    mount(onDone, (tween) => flushed.push(tween.finish()));
    act(() => api.current!.tween.start(FROM, TO));
    frame();
    frame(100);
    act(() => root.unmount());
    expect(queue.size).toBe(0);
    expect(flushed[flushed.length - 1]).toBe(TO);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(TO);
    root = createRoot(host); // afterEach unmounts again
  });

  it('jumps straight to the final state under reduced motion', () => {
    vi.stubGlobal('matchMedia', (q: string) => ({ matches: q.includes('reduce') }));
    const onDone = vi.fn();
    mount(onDone);
    act(() => api.current!.tween.start(FROM, TO));
    expect(api.current!.markers).toBe(TO);
    expect(api.current!.tween.running.current).toBe(false);
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(onDone).toHaveBeenCalledWith(TO);
  });
});
