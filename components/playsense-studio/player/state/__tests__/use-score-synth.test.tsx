// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SynthNote } from '@/lib/playsense-studio/score-synth';

const setNotes = vi.fn();
const start = vi.fn();
const reanchor = vi.fn();
const teardown = vi.fn();
let running = false;
vi.mock('@/lib/playsense-studio/score-synth', () => ({
  ScoreSynth: class {
    setNotes = setNotes;
    setVolume() {}
    setLoop() {}
    ensureContext() {
      return { state: 'running', resume: () => Promise.resolve() };
    }
    start(media: number, rate: number) {
      running = true;
      start(media, rate);
    }
    reanchor = reanchor;
    teardown() {
      running = false;
      teardown();
    }
    get isRunning() {
      return running;
    }
    drift() {
      return null;
    }
    close() {}
  },
}));

import { synthNotesKey, useScoreSynth } from '../use-score-synth';

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const note = (start: number, midi = 60): SynthNote => ({ start, end: start + 0.5, midi, voice: 1, percussion: false });

describe('synthNotesKey', () => {
  it('changes when an interior note moves or changes pitch', () => {
    const a = [note(0), note(1), note(2)];
    expect(synthNotesKey(a)).toBe(synthNotesKey([note(0), note(1), note(2)]));
    expect(synthNotesKey(a)).not.toBe(synthNotesKey([note(0), note(1.01), note(2)]));
    expect(synthNotesKey(a)).not.toBe(synthNotesKey([note(0), note(1, 61), note(2)]));
  });
});

describe('useScoreSynth', () => {
  let container: HTMLDivElement;
  let root: Root;
  let video: HTMLVideoElement;

  function Harness({ enabled, notes }: { enabled: boolean; notes: SynthNote[] }) {
    useScoreSynth({ videoRef: { current: video }, notes, enabled });
    return null;
  }

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    for (const f of [setNotes, start, reanchor, teardown]) f.mockClear();
    running = false;
    container = document.createElement('div');
    root = createRoot(container);
    video = document.createElement('video');
    Object.defineProperty(video, 'paused', { configurable: true, value: true, writable: true });
    video.currentTime = 3;
  });

  afterEach(() => {
    act(() => root.unmount());
  });

  it('sets the notes, starts on play at the video position and tears down on pause', () => {
    const notes = [note(3.2), note(4)];
    act(() => root.render(<Harness enabled notes={notes} />));
    expect(setNotes).toHaveBeenCalledWith(notes);
    expect(start).not.toHaveBeenCalled();

    act(() => {
      (video as unknown as { paused: boolean }).paused = false;
      video.dispatchEvent(new Event('play'));
    });
    expect(start).toHaveBeenCalledWith(3, 1);

    teardown.mockClear();
    act(() => {
      (video as unknown as { paused: boolean }).paused = true;
      video.dispatchEvent(new Event('pause'));
    });
    expect(teardown).toHaveBeenCalled();
  });

  it('schedules nothing while disabled (Hear: Recording)', () => {
    act(() => root.render(<Harness enabled={false} notes={[note(3.2)]} />));
    act(() => {
      (video as unknown as { paused: boolean }).paused = false;
      video.dispatchEvent(new Event('play'));
    });
    expect(start).not.toHaveBeenCalled();
  });

  it('does not reset the notes when an equal array is passed again', () => {
    act(() => root.render(<Harness enabled notes={[note(3.2)]} />));
    act(() => root.render(<Harness enabled notes={[note(3.2)]} />));
    expect(setNotes).toHaveBeenCalledTimes(1);
  });
});
