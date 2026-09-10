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
