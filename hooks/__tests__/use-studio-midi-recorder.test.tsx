// @vitest-environment jsdom
import { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useStudioMidiRecorder } from '../use-studio-midi-recorder';
let now = 0;
class Input extends EventTarget {
  id = 'piano'; name = 'Test piano'; manufacturer = 'Test'; state = 'connected';
  message(data: number[], stamp = now) { const e = new Event('midimessage'); Object.defineProperties(e, { data: { value: new Uint8Array(data) }, timeStamp: { value: stamp } }); this.dispatchEvent(e); }
}
class Access extends EventTarget { inputs = new Map<string, Input>(); }
const audios: AudioMock[] = [];
class AudioMock {
  state = 'running'; destination = {};
  get currentTime() { return now / 1000; }
  resume = vi.fn(async () => {});
  close = vi.fn(async () => { this.state = 'closed'; });
  createOscillator() { return { frequency: { value: 0 }, connect: vi.fn(), disconnect: vi.fn(), start: vi.fn(), stop: vi.fn(), onended: null }; }
  createGain() { return { gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn(), disconnect: vi.fn() }; }
  constructor() { audios.push(this); }
}
let root: Root, recorder: ReturnType<typeof useStudioMidiRecorder>, input: Input, access: Access;
function Harness() { const value = useStudioMidiRecorder(); useLayoutEffect(() => { recorder = value; }, [value]); return null; }
const options = { bpm: 120, timeSignature: [4, 4] as [number, number], countIn: true, click: false, sustain: true };
async function advance(ms: number) { await act(async () => { now += ms; vi.advanceTimersByTime(ms); }); }
beforeEach(async () => {
  vi.useFakeTimers(); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true); now = 1000; audios.length = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now); vi.stubGlobal('AudioContext', AudioMock);
  input = new Input(); access = new Access(); access.inputs.set(input.id, input);
  Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(async () => access) });
  root = createRoot(document.createElement('div'));
  await act(async () => { root.render(<Harness />); });
});
afterEach(async () => { await act(async () => root.unmount()); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('Studio MIDI recorder lifecycle', () => {
  it('requests only MIDI access on connect and records source timestamps after count-in', async () => {
    expect(navigator.requestMIDIAccess).not.toHaveBeenCalled();
    await act(async () => { await recorder.connect(); });
    expect(navigator.requestMIDIAccess).toHaveBeenCalledWith({ sysex: false });
    expect(recorder.selectedInput).toBe('piano');
    await act(async () => { await recorder.start(options); });
    expect(recorder.phase).toBe('count-in');
    input.message([0x90, 60, 100]);
    await advance(2200); // downbeat = 3080
    expect(recorder.phase).toBe('recording');
    input.message([0x90, 64, 100], 3103.75); // delayed delivery must retain timestamp
    await advance(500);
    input.message([0x80, 64, 0], 3613.25);
    await act(async () => recorder.stop());
    expect(recorder.phase).toBe('review');
    expect(recorder.take?.notes).toHaveLength(1);
    expect(recorder.take?.notes[0]).toMatchObject({ midi: 64, startMs: 23.75, endMs: 533.25 });
    expect(audios[0].close).toHaveBeenCalledOnce();
  });
  it('keeps a partial take when the selected instrument disconnects', async () => {
    await act(async () => { await recorder.connect(); await recorder.start({ ...options, countIn: false }); });
    await advance(100); input.message([0x90, 60, 100]); await advance(500);
    await act(async () => { input.state = 'disconnected'; access.inputs.clear(); access.dispatchEvent(new Event('statechange')); });
    expect(recorder.phase).toBe('review');
    expect(recorder.take?.notes[0]).toMatchObject({ startMs: 20, endMs: 520 });
    expect(recorder.error).toMatch(/disconnected/);
    expect(recorder.selectedInput).toBe('');
  });
  it('stops an interrupted clock and can discard and start a fresh take', async () => {
    await act(async () => { await recorder.connect(); await recorder.start({ ...options, countIn: false }); });
    await advance(100); input.message([0x90, 60, 100]); audios[0].state = 'suspended';
    await advance(100);
    expect(recorder.phase).toBe('review');
    expect(recorder.error).toMatch(/interrupted/);
    await act(async () => recorder.discard());
    expect(recorder.take).toBeNull();
    await act(async () => { await recorder.start(options); });
    expect(recorder.phase).toBe('count-in');
    expect(audios).toHaveLength(2);
  });
  it('only listens to the selected port and preserves unrelated listeners on cleanup', async () => {
    const other = new Input(); other.id = 'drums'; access.inputs.set(other.id, other);
    const unrelated = vi.fn(); input.addEventListener('midimessage', unrelated);
    const remove = vi.spyOn(input, 'removeEventListener');
    await act(async () => { await recorder.connect(); recorder.selectInput(other.id); await recorder.start({ ...options, countIn: false }); });
    await advance(100); input.message([0x90, 60, 100]); other.message([0x90, 64, 100]);
    await act(async () => recorder.stop());
    expect(recorder.take?.notes.map(n => n.midi)).toEqual([64]);
    expect(remove).toHaveBeenCalled(); expect(unrelated).toHaveBeenCalledOnce();
  });
  it('cleans up the clock on close without waiting for the next frame', async () => {
    await act(async () => { await recorder.connect(); await recorder.start(options); });
    await act(async () => root.render(null));
    expect(audios[0].close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('shows an actionable permission denial and permits retry', async () => {
    vi.mocked(navigator.requestMIDIAccess).mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'));
    await act(async () => { await recorder.connect(); });
    expect(recorder.error).toMatch(/Allow MIDI/); expect(recorder.connecting).toBe(false);
    await act(async () => { await recorder.connect(); });
    expect(recorder.connected).toBe(true); expect(recorder.error).toBeNull();
  });
});

class VideoMock extends EventTarget {
  currentTime = 0; playbackRate = 1; readyState = 4; duration = 300; seeking = false; paused = true; ended = false; loop = true;
  play = vi.fn(async () => { this.paused = false; this.dispatchEvent(new Event('playing')); });
  pause = vi.fn(() => { if (!this.paused) { this.paused = true; this.dispatchEvent(new Event('pause')); } });
  event(name: string) { this.dispatchEvent(new Event(name)); }
}
async function startVideo(video: VideoMock, overrides = {}) {
  await act(async () => { await recorder.connect(); await recorder.start({ ...options, countIn: false, ...overrides, video: { element: video as unknown as HTMLVideoElement, startSeconds: 30 } }); });
  await advance(100);
}

describe('MIDI recording follows reference video time', () => {
  it('holds the video at the playhead for count-in and starts it when recording begins', async () => {
    const video = new VideoMock();
    await act(async () => { await recorder.connect(); await recorder.start({ ...options, video: { element: video as unknown as HTMLVideoElement, startSeconds: 30 } }); });
    expect(video.currentTime).toBe(30); expect(video.loop).toBe(false);
    expect(video.play).not.toHaveBeenCalled(); expect(recorder.phase).toBe('count-in');
    input.message([0x90, 60, 100]);
    await advance(2100);
    expect(video.play).toHaveBeenCalledOnce(); expect(recorder.phase).toBe('recording');
    video.currentTime = 30.5; await advance(500); input.message([0x90, 64, 100]);
    video.currentTime = 31; await advance(500); input.message([0x80, 64, 0]);
    await act(async () => recorder.stop());
    expect(recorder.take?.startVideoSeconds).toBe(30);
    expect(recorder.take?.notes).toHaveLength(1);
    expect(recorder.take?.notes[0]).toMatchObject({ startMs: 500, endMs: 1000 });
    expect(video.paused).toBe(true);
  });
  it('captures source video timing at half speed, accounting for delayed MIDI delivery', async () => {
    const video = new VideoMock(); video.playbackRate = .5;
    await startVideo(video);
    video.currentTime = 31; await advance(2000); input.message([0x90, 60, 100], now - 50);
    video.currentTime = 31.5; await advance(1000); input.message([0x80, 60, 0], now - 20);
    await act(async () => recorder.stop());
    expect(recorder.take?.notes[0]).toMatchObject({ startMs: 975, endMs: 1490 });
    expect(recorder.take?.durationMs).toBe(1500);
  });
  it('does not advance or add attacks during buffering and keeps releases at the frozen video position', async () => {
    const video = new VideoMock(); await startVideo(video);
    video.currentTime = 30.5; await advance(500); input.message([0x90, 60, 100]);
    video.event('waiting'); await advance(5000);
    input.message([0x80, 60, 0]); input.message([0x90, 64, 100]);
    expect(recorder.meter.elapsedMs).toBe(500);
    video.event('playing'); video.currentTime = 31; await advance(500); input.message([0x90, 67, 100]);
    video.currentTime = 31.5; await advance(500); await act(async () => recorder.stop());
    expect(recorder.take?.notes.map(n => n.midi)).toEqual([60, 67]);
    expect(recorder.take?.notes[0].endMs).toBeCloseTo(501); // minimum held-note duration
    expect(recorder.take?.notes[1]).toMatchObject({ startMs: 1000, endMs: 1500 });
  });
  it('waits for playback to really start instead of recording through a startup delay', async () => {
    const video = new VideoMock(); let played!: () => void;
    video.play.mockImplementationOnce(() => new Promise(resolve => { played = () => { video.paused = false; video.event('playing'); resolve(); }; }));
    await startVideo(video); await advance(2000); input.message([0x90, 60, 100]);
    expect(recorder.phase).toBe('starting'); expect(recorder.meter.elapsedMs).toBe(0);
    await act(async () => played());
    video.currentTime = 30.25; await advance(250); input.message([0x90, 64, 100]);
    video.currentTime = 30.5; await advance(250); await act(async () => recorder.stop());
    expect(recorder.take?.notes).toHaveLength(1);
    expect(recorder.take?.notes[0]).toMatchObject({ midi: 64, startMs: 250, endMs: 500 });
  });
  it('stops at video end and preserves a take if the playhead is moved', async () => {
    const video = new VideoMock(); await startVideo(video);
    video.currentTime = 30.5; await advance(500); input.message([0x90, 60, 100]);
    video.currentTime = 31; await advance(500);
    await act(async () => { video.currentTime = 80; video.seeking = true; video.event('seeking'); });
    expect(recorder.take?.durationMs).toBe(1000); expect(recorder.error).toMatch(/moved/);
    await act(async () => recorder.discard()); video.seeking = false;
    await startVideo(video); video.currentTime = 30.5; await advance(500); input.message([0x90, 60, 100]);
    await act(async () => { video.currentTime = 31; video.ended = true; video.event('ended'); });
    expect(recorder.phase).toBe('review'); expect(recorder.take?.durationMs).toBe(1000);
  });
  it('reports rejected video playback and cleans up the capture session', async () => {
    const video = new VideoMock(); video.play.mockRejectedValueOnce(new Error('Not allowed'));
    await startVideo(video);
    expect(recorder.phase).toBe('idle'); expect(recorder.error).toMatch(/video could not start/);
    expect(audios[0].state).toBe('closed'); expect(vi.getTimerCount()).toBe(0);
  });
  it('stops video playback and reports the matching playhead when the panel closes', async () => {
    const video = new VideoMock(); const onStop = vi.fn();
    await act(async () => { await recorder.connect(); await recorder.start({ ...options, countIn: false, video: { element: video as unknown as HTMLVideoElement, startSeconds: 30, onStop } }); });
    await advance(100); video.currentTime = 31; await advance(1000);
    await act(async () => root.render(null));
    expect(video.paused).toBe(true); expect(onStop).toHaveBeenCalledWith(31);
    expect(vi.getTimerCount()).toBe(0);
  });
  it('cancels a loading video without cancelling a new recording or leaving listeners behind', async () => {
    const loading = new VideoMock(); loading.readyState = 0;
    const onStop = vi.fn();
    let pending!: Promise<void>;
    await act(async () => {
      await recorder.connect();
      pending = recorder.start({ ...options, video: { element: loading as unknown as HTMLVideoElement, startSeconds: 30, onStop } });
      await Promise.resolve();
    });
    expect(recorder.phase).toBe('starting');
    const next = new VideoMock();
    await act(async () => {
      recorder.stop();
      await recorder.start({ ...options, video: { element: next as unknown as HTMLVideoElement, startSeconds: 30 } });
      await pending;
    });
    expect(recorder.phase).toBe('count-in');
    expect(onStop).toHaveBeenCalledOnce();
    expect(audios[1].state).toBe('running');
    expect(vi.getTimerCount()).toBe(1);
  });
});
