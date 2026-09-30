// @vitest-environment jsdom
// components/playsense-studio/studio/__tests__/wave-tools.test.tsx
import { act } from 'react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WaveTools } from '../wave-tools';

declare global { var IS_REACT_ACT_ENVIRONMENT: boolean }
let host: HTMLDivElement; let root: Root;
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); });
afterEach(() => { act(() => root.unmount()); host.remove(); });
const zoom = { pps: 40, onZoomTo: vi.fn(), onZoomBy: vi.fn(), onFit: vi.fn() };
const byLabel = (l: string) => host.querySelector(`[aria-label="${l}"]`) as HTMLButtonElement | null;

describe('WaveTools', () => {
  it('shows the video tools in one cluster', () => {
    const onAutoPlace = vi.fn();
    act(() => root.render(<WaveTools graded={false} onAutoPlace={onAutoPlace} dragAll onDragAll={() => {}} flexMode={false} onFlex={() => {}} showNotes onShowNotes={() => {}} zoom={zoom} />));
    const cluster = host.querySelector('.st-wtools')!;
    for (const l of ['Auto-place bars', 'Ripple', 'Single', 'Flex', 'Notes on the waveform', 'Fit the section']) {
      expect(cluster.querySelector(`[aria-label="${l}"]`), l).not.toBeNull();
    }
    act(() => byLabel('Auto-place bars')!.click());
    expect(onAutoPlace).toHaveBeenCalled();
  });

  it('shows Auto-align and Student preview for a graded part, with marker controls and optional Flex', () => {
    act(() => root.render(<WaveTools graded onAutoAlign={() => {}} onStudentPreview={() => {}} dragAll onDragAll={() => {}} showNotes onShowNotes={() => {}} zoom={zoom} />));
    expect(byLabel('Auto-align')).not.toBeNull();
    expect(byLabel('Student preview')).not.toBeNull();
    expect(byLabel('Ripple')).not.toBeNull();
    expect(byLabel('Flex')).toBeNull();
  });

  // Final review Minor 1: the zoom slider's own 34px pill (background, border)
  // used to poke out of the 32px WaveTools cluster. Flattened to an inline
  // control scoped under .st-wtools.
  it('nests the zoom slider directly under .st-wtools, flattened by its own rule', () => {
    act(() => root.render(<WaveTools graded={false} onAutoPlace={() => {}} dragAll onDragAll={() => {}} flexMode={false} onFlex={() => {}} showNotes onShowNotes={() => {}} zoom={zoom} />));
    const cluster = host.querySelector('.st-wtools')!;
    expect(cluster.querySelector('.st-zoom')).not.toBeNull();
    const css = readFileSync(resolve(process.cwd(), 'app/globals.css'), 'utf8');
    const rule = css.match(/\.st-wtools \.st-zoom\s*\{([^}]*)\}/)?.[1] ?? '';
    expect(rule).toMatch(/height:\s*26px/);
    expect(rule).toMatch(/background:\s*none/);
    expect(rule).toMatch(/border:\s*0/);
  });
});
