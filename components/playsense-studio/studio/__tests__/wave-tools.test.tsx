// @vitest-environment jsdom
// components/playsense-studio/studio/__tests__/wave-tools.test.tsx
import { act } from 'react';
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

  it('shows Auto-align and Student preview for a graded part, without Ripple or Flex', () => {
    act(() => root.render(<WaveTools graded onAutoAlign={() => {}} onStudentPreview={() => {}} dragAll onDragAll={() => {}} showNotes onShowNotes={() => {}} zoom={zoom} />));
    expect(byLabel('Auto-align')).not.toBeNull();
    expect(byLabel('Student preview')).not.toBeNull();
    expect(byLabel('Ripple')).toBeNull();
    expect(byLabel('Flex')).toBeNull();
  });
});
