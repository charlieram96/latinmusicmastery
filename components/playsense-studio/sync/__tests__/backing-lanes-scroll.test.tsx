// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { BackingLanes } from '../backing-lanes';

it('leaves vertical wheel scrolling native and reserves horizontal gestures for the timeline', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const canvas = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  const pan = vi.fn();
  const zoom = vi.fn();
  try {
    act(() => root.render(<BackingLanes clips={[]} pixelsPerSecond={40} scrollLeftPx={0}
      selectedTrackId={null} snapTimes={[]} getCurrentSeconds={() => 0} isPlaying={false}
      onSelect={() => {}} onClipChange={() => {}} onClipCommit={() => {}} onScrollByPx={pan} onZoomBy={zoom} />));
    const overlay = host.querySelector('.st-backing-lane-overlay')!;
    const vertical = new WheelEvent('wheel', { deltaY: 80, bubbles: true, cancelable: true });
    overlay.dispatchEvent(vertical);
    expect(vertical.defaultPrevented).toBe(false);
    expect(pan).not.toHaveBeenCalled();
    const horizontal = new WheelEvent('wheel', { deltaX: 60, deltaY: 2, bubbles: true, cancelable: true });
    overlay.dispatchEvent(horizontal);
    expect(horizontal.defaultPrevented).toBe(true);
    expect(pan).toHaveBeenLastCalledWith(60);
    overlay.dispatchEvent(new WheelEvent('wheel', { deltaY: 40, shiftKey: true, cancelable: true }));
    expect(pan).toHaveBeenLastCalledWith(40);
    overlay.dispatchEvent(new WheelEvent('wheel', { deltaY: -10, ctrlKey: true, cancelable: true }));
    expect(zoom).toHaveBeenCalled();
  } finally {
    act(() => root.unmount());
    host.remove();
    canvas.mockRestore();
  }
});
