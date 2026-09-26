// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { KeysPanel, MSG_GM_DRUMS, MSG_MIDI_FALLBACK, MSG_MIDI_READY, type KeysPanelProps } from '../keys-panel';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function render(props: Partial<KeysPanelProps> = {}) {
  const all: KeysPanelProps = {
    onPitch: vi.fn(), onOctave: vi.fn(),
    percussion: false, status: 'unavailable', octave: 4, ...props,
  };
  act(() => root.render(<KeysPanel {...all} />));
  return all;
}

const click = (el: Element, init: MouseEventInit = {}) =>
  act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, ...init })); });

describe('KeysPanel', () => {
  it('shows the fallback text without a MIDI keyboard, and the ready line with one', () => {
    render({ status: 'unavailable' });
    expect(host.textContent).toContain(MSG_MIDI_FALLBACK);
    render({ status: 'ready' });
    expect(host.textContent).toContain(MSG_MIDI_READY);
  });

  it('has 24 keys from C4 to B5, and a click enters that pitch', () => {
    const props = render();
    expect(host.querySelectorAll('.st-key-white, .st-key-black')).toHaveLength(24);
    expect(host.querySelector('[data-testid="keys-range"]')?.textContent).toBe('C4–B5');
    click(host.querySelector('[data-testid="key-70"]')!);
    expect(props.onPitch).toHaveBeenCalledWith(70);
  });

  it('treats every click as a new note, ⇧ or not', () => {
    const props = render();
    click(host.querySelector('[data-testid="key-64"]')!, { shiftKey: true });
    expect(props.onPitch).toHaveBeenCalledWith(64);
  });

  it('says the keys are GM drums on a percussion track', () => {
    render({ percussion: true });
    expect(host.textContent).toContain(MSG_GM_DRUMS);
    render({ percussion: false });
    expect(host.textContent).not.toContain(MSG_GM_DRUMS);
  });

  it('shifts the octave, and disables the shift at the ends of the range', () => {
    const props = render({ octave: 1 });
    const [down, up] = host.querySelectorAll('.st-keys-octave button');
    expect((down as HTMLButtonElement).disabled).toBe(true);
    click(up);
    expect(props.onOctave).toHaveBeenCalledWith(1);
    render({ octave: 7 });
    expect((host.querySelectorAll('.st-keys-octave button')[1] as HTMLButtonElement).disabled).toBe(true);
  });
});
