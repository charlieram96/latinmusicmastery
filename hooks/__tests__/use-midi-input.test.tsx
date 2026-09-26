// @vitest-environment jsdom
import { useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useMidiInput } from '../use-midi-input';

class Input extends EventTarget {
  id = 'piano'; name = 'Test piano'; manufacturer = 'Test'; state = 'connected';
  message(data: number[], stamp = 0) { const e = new Event('midimessage'); Object.defineProperties(e, { data: { value: new Uint8Array(data) }, timeStamp: { value: stamp } }); this.dispatchEvent(e); }
}
class Access extends EventTarget { inputs = new Map<string, Input>(); }

let root: Root;
let onNoteOn: ReturnType<typeof vi.fn>;
let result: { status: 'idle' | 'ready' | 'unavailable' } | undefined;
let input: Input;
let access: Access;

function Harness({ enabled }: { enabled: boolean }) {
  const value = useMidiInput(enabled, onNoteOn);
  useLayoutEffect(() => { result = value; });
  return null;
}

async function render(enabled: boolean) {
  await act(async () => { root.render(<Harness enabled={enabled} />); });
}

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  onNoteOn = vi.fn();
  result = undefined;
  input = new Input();
  access = new Access();
  access.inputs.set(input.id, input);
  root = createRoot(document.createElement('div'));
});

afterEach(async () => {
  await act(async () => root.unmount());
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  // @ts-expect-error test cleanup of a possibly-defined global
  delete navigator.requestMIDIAccess;
});

describe('useMidiInput', () => {
  it('starts idle and requests access only once it is enabled', async () => {
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(async () => access) });
    await render(false);
    expect(result?.status).toBe('idle');
    expect(navigator.requestMIDIAccess).not.toHaveBeenCalled();
    await render(true);
    expect(navigator.requestMIDIAccess).toHaveBeenCalledExactlyOnceWith({ sysex: false });
    expect(result?.status).toBe('ready');
  });

  it('reports a note-on with its midi number and timestamp', async () => {
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(async () => access) });
    await render(true);
    input.message([0x90, 64, 100], 12.5);
    expect(onNoteOn).toHaveBeenCalledExactlyOnceWith(64, 12.5);
  });

  it('ignores a note-on with velocity 0 (a note-off in disguise)', async () => {
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(async () => access) });
    await render(true);
    input.message([0x90, 64, 0], 12.5);
    expect(onNoteOn).not.toHaveBeenCalled();
  });

  it('ignores other message types such as note-off and control change', async () => {
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(async () => access) });
    await render(true);
    input.message([0x80, 64, 100], 1);
    input.message([0xb0, 64, 100], 2);
    expect(onNoteOn).not.toHaveBeenCalled();
  });

  it('listens on an input connected after access was granted', async () => {
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(async () => access) });
    await render(true);
    const second = new Input(); second.id = 'drums';
    await act(async () => { access.inputs.set(second.id, second); access.dispatchEvent(new Event('statechange')); });
    second.message([0x90, 40, 90], 5);
    expect(onNoteOn).toHaveBeenCalledExactlyOnceWith(40, 5);
  });

  it('reports unavailable when the browser has no Web MIDI support', async () => {
    // @ts-expect-error simulating an absent API
    navigator.requestMIDIAccess = undefined;
    await render(true);
    expect(result?.status).toBe('unavailable');
  });

  it('reports unavailable when access is rejected', async () => {
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(async () => { throw new DOMException('Denied', 'NotAllowedError'); }) });
    await render(true);
    expect(result?.status).toBe('unavailable');
  });

  it('detaches its listeners when disabled', async () => {
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(async () => access) });
    await render(true);
    await render(false);
    input.message([0x90, 64, 100], 1);
    expect(onNoteOn).not.toHaveBeenCalled();
  });

  it('does not request access again when re-enabled', async () => {
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(async () => access) });
    await render(true);
    await render(false);
    await render(true);
    expect(navigator.requestMIDIAccess).toHaveBeenCalledOnce();
    input.message([0x90, 64, 100], 1);
    expect(onNoteOn).toHaveBeenCalledExactlyOnceWith(64, 1);
  });

  it('asks again when re-enabled after a refusal', async () => {
    const request = vi.fn()
      .mockRejectedValueOnce(new DOMException('Denied', 'NotAllowedError'))
      .mockResolvedValueOnce(access);
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: request });
    await render(true);
    expect(result?.status).toBe('unavailable');
    await render(false);
    await render(true);
    expect(request).toHaveBeenCalledTimes(2);
    expect(result?.status).toBe('ready');
  });

  it('detaches its listeners on unmount', async () => {
    Object.defineProperty(navigator, 'requestMIDIAccess', { configurable: true, value: vi.fn(async () => access) });
    await render(true);
    await act(async () => root.unmount());
    input.message([0x90, 64, 100], 1);
    expect(onNoteOn).not.toHaveBeenCalled();
  });
});
