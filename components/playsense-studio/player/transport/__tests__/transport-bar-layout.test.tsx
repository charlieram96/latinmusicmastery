// @vitest-environment jsdom
// components/playsense-studio/player/transport/__tests__/transport-bar-layout.test.tsx
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TransportBar } from '../transport-bar';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }
let host: HTMLDivElement; let root: Root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });

const base = {
  currentSeconds: 5, durationSeconds: 100, isPlaying: false, playbackRate: 1,
  onToggle() {}, onRestart() {}, onSeek() {}, onRateChange() {},
  loopA: null, loopB: null, loopEnabled: false, onToggleLoop() {}, onClearLoop() {},
  bpm: 96, beatsPerMeasure: 4,
};

describe('TransportBar layout', () => {
  it('keeps the two-row student layout by default', () => {
    act(() => root.render(<TransportBar {...base} />));
    const play = host.querySelector('[aria-label="Play"]')!;
    expect(host.querySelector('.st-transport-row')).toBeNull();
    // the scrubber is a sibling row above the controls, not inside them
    expect(play.parentElement!.querySelector('[class*="touch-none"]')).toBeNull();
  });

  it('puts the scrubber and the extras in one row with layout="row"', () => {
    act(() => root.render(<TransportBar {...base} layout="row" extra={<span data-testid="hear">Hear</span>} />));
    const row = host.querySelector('.st-transport-row')!;
    expect(row.contains(host.querySelector('[aria-label="Play"]'))).toBe(true);
    expect(row.querySelector('[class*="touch-none"]')).not.toBeNull();
    expect(row.querySelector('[data-testid="hear"]')).not.toBeNull();
  });
});

it('derives BPM from speed and resets both controls to the score reference',()=>{
 const rate=vi.fn();
 act(()=>root.render(<TransportBar {...base} bpm={120} playbackRate={1.5} onRateChange={rate}/>));
 act(()=>host.querySelector<HTMLButtonElement>('[aria-haspopup="dialog"]')!.click());
 expect(host.querySelector<HTMLInputElement>('[aria-label="Tempo BPM"]')!.value).toBe('180');
 const resets=[...host.querySelectorAll<HTMLButtonElement>('button')].filter(b=>b.textContent?.includes('Reset'));
 expect(resets).toHaveLength(2);
 for(const b of resets){act(()=>b.click());expect(rate).toHaveBeenLastCalledWith(1);}
 act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Increase tempo"]')!.click());
 expect(rate).toHaveBeenLastCalledWith(181/120);
});

it('sets video loop endpoints at the playhead and reflects the shared staff range', () => {
 const onSetLoopA = vi.fn(), onSetLoopB = vi.fn(), onToggleLoop = vi.fn();
 act(() => root.render(<TransportBar {...base} onSetLoopA={onSetLoopA} onSetLoopB={onSetLoopB} onToggleLoop={onToggleLoop}/>));
 const button = (name: string) => host.querySelector(`[aria-label="${name}"]`) as HTMLButtonElement;
 expect(button('Set loop end (B)').disabled).toBe(true);
 act(() => button('Set loop start (A)').click());
 expect(onSetLoopA).toHaveBeenCalledWith(5);
 act(() => root.render(<TransportBar {...base} currentSeconds={8} loopA={5} loopB={10} loopEnabled onSetLoopA={onSetLoopA} onSetLoopB={onSetLoopB} onToggleLoop={onToggleLoop}/>));
 expect(button('Set loop start (A)').getAttribute('aria-pressed')).toBe('true');
 expect(button('Set loop end (B)').getAttribute('aria-pressed')).toBe('true');
 act(() => button('Set loop end (B)').click());
 expect(onSetLoopB).toHaveBeenCalledWith(8);
 act(() => (host.querySelector('[title="Loop on"]') as HTMLButtonElement).click());
 expect(onToggleLoop).toHaveBeenCalledOnce();
});

it('exposes manual metronome on/off without opening the tempo menu',()=>{
 const onClickOnChange=vi.fn();
 act(()=>root.render(<TransportBar {...base} clickOn={true} onClickOnChange={onClickOnChange}/>));
 const toggle=host.querySelector<HTMLButtonElement>('[aria-label="Turn metronome off"]')!;
 expect(toggle).toBeTruthy();
 act(()=>{toggle.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));toggle.click();});
 expect(onClickOnChange).toHaveBeenCalledWith(false);
});
