// @vitest-environment jsdom
//
// Drag continuity on the waveform canvas.
//
// The canvas keeps its drag state (mode/target/pointerId) in variables local to
// the pointer-interaction effect. Every drag callback re-renders the parent, so
// if that effect's identity-unstable deps make it re-subscribe mid-drag, the
// drag resets to idle and every pointermove after the first is dropped.

import { useCallback, useState } from 'react';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { WaveformCanvas, type DragMode } from '../waveform-canvas';

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean;
}

const PPS = 10;

function pointer(
  type: string,
  x: number,
  y: number,
  mods: { altKey?: boolean; metaKey?: boolean } = {}
) {
  const e = new MouseEvent(type, {
    clientX: x,
    clientY: y,
    bubbles: true,
    cancelable: true,
    altKey: mods.altKey ?? false,
    metaKey: mods.metaKey ?? false,
  });
  Object.defineProperty(e, 'pointerId', { value: 1 });
  return e;
}

/**
 * Mirrors SyncPanel: the dragged values live in parent state, so every drag step
 * re-renders, and the callbacks handed to the canvas are identity-unstable —
 * `onDragEnd` is an inline arrow there, and `onSeek` is a useCallback over the
 * transport clock, which is a fresh object on every render.
 */
function Harness({
  onTrimDrag,
  onMarkerDrag,
  onNoteDrag,
  noteAt,
  markerStart = 5,
  dragAll = false,
}: {
  onTrimDrag?: (edge: 'in' | 'out', t: number) => void;
  onMarkerDrag?: (t: number, mode?: DragMode, mods?: { snap: boolean }) => void;
  onNoteDrag?: (t: number) => void;
  /** When set, the selected note's handle sits here (seconds). */
  noteAt?: number;
  markerStart?: number;
  dragAll?: boolean;
}) {
  const [trimIn, setTrimIn] = useState(5);
  const [markerAt, setMarkerAt] = useState(markerStart);
  const [noteTime, setNoteTime] = useState(noteAt ?? 0);
  const [, setMarkers] = useState(0);

  const handleTrimDrag = useCallback(
    (edge: 'in' | 'out', t: number) => {
      onTrimDrag?.(edge, t);
      setTrimIn(t);
    },
    [onTrimDrag]
  );

  const handleMarkerDrag = useCallback(
    (_ref: unknown, t: number, mode?: DragMode, mods?: { snap: boolean }) => {
      onMarkerDrag?.(t, mode, mods);
      setMarkerAt(t);
    },
    [onMarkerDrag]
  );

  const handleNoteDrag = useCallback(
    (t: number) => {
      onNoteDrag?.(t);
      setNoteTime(t);
    },
    [onNoteDrag]
  );

  return (
    <WaveformCanvas
      peaks={null}
      durationSeconds={60}
      handles={[
        { measureNumber: 1, beatInMeasure: 1, isDownbeat: true, videoTimeSeconds: markerAt },
      ]}
      noteTicks={[]}
      showNotes={false}
      selectedNote={noteAt === undefined ? null : { videoTimeSeconds: noteTime }}
      onNoteDrag={handleNoteDrag}
      tailVideoTimeSeconds={60}
      pixelsPerSecond={PPS}
      scrollLeftPx={0}
      dragAll={dragAll}
      selected={null}
      getCurrentSeconds={() => 0}
      onSeek={() => {}}
      onSelect={() => {}}
      onMarkerDrag={handleMarkerDrag}
      onTailDrag={() => {}}
      // Inline arrow, exactly as SyncPanel passes it: new identity every render.
      onDragEnd={() => setMarkers((n) => n)}
      onScrollByPx={() => {}}
      onViewportWidth={() => {}}
      trimInSeconds={trimIn}
      trimOutSeconds={null}
      mediaDurationSeconds={60}
      onTrimDrag={handleTrimDrag}
    />
  );
}

describe('WaveformCanvas trim drag', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    global.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('keeps reporting drag positions across every pointermove', () => {
    const calls: Array<[string, number]> = [];
    act(() => {
      root.render(<Harness onTrimDrag={(edge, t) => calls.push([edge, t])} />);
    });

    const overlay = container.querySelectorAll('canvas')[1];
    expect(overlay).toBeTruthy();

    // Grab the in-grip: trimIn 5s * 10px/s = x 50, inside the top label band.
    act(() => {
      overlay.dispatchEvent(pointer('pointerdown', 50, 10));
    });
    // Three moves past the 4px threshold: 10s, 15s, 20s.
    for (const x of [100, 150, 200]) {
      act(() => {
        overlay.dispatchEvent(pointer('pointermove', x, 10));
      });
    }
    act(() => {
      overlay.dispatchEvent(pointer('pointerup', 200, 10));
    });

    expect(calls).toEqual([
      ['in', 10],
      ['in', 15],
      ['in', 20],
    ]);
  });

  it('keeps reporting marker positions across every pointermove', () => {
    const calls: number[] = [];
    act(() => {
      root.render(<Harness onMarkerDrag={(t) => calls.push(t)} />);
    });

    const overlay = container.querySelectorAll('canvas')[1];
    // Below the label band, so this is the marker pool rather than a trim grip.
    act(() => {
      overlay.dispatchEvent(pointer('pointerdown', 50, 100));
    });
    for (const x of [100, 150, 200]) {
      act(() => {
        overlay.dispatchEvent(pointer('pointermove', x, 100));
      });
    }
    act(() => {
      overlay.dispatchEvent(pointer('pointerup', 200, 100));
    });

    expect(calls).toEqual([10, 15, 20]);
  });

  it('keeps reporting note positions across every pointermove', () => {
    const calls: number[] = [];
    const markerCalls: number[] = [];
    act(() => {
      root.render(
        <Harness noteAt={5} markerStart={30} onNoteDrag={(t) => calls.push(t)} onMarkerDrag={(t) => markerCalls.push(t)} />
      );
    });

    const overlay = container.querySelectorAll('canvas')[1];
    act(() => {
      overlay.dispatchEvent(pointer('pointerdown', 50, 100));
    });
    for (const x of [100, 150, 200]) {
      act(() => {
        overlay.dispatchEvent(pointer('pointermove', x, 100));
      });
    }
    act(() => {
      overlay.dispatchEvent(pointer('pointerup', 200, 100));
    });

    expect(calls).toEqual([10, 15, 20]);
    expect(markerCalls).toEqual([]);
  });

  it('the selected note wins a tie with a coincident marker', () => {
    const calls: number[] = [];
    const markerCalls: number[] = [];
    act(() => {
      root.render(
        <Harness noteAt={5} markerStart={5} onNoteDrag={(t) => calls.push(t)} onMarkerDrag={(t) => markerCalls.push(t)} />
      );
    });

    const overlay = container.querySelectorAll('canvas')[1];
    act(() => {
      overlay.dispatchEvent(pointer('pointerdown', 50, 100));
    });
    act(() => {
      overlay.dispatchEvent(pointer('pointermove', 100, 100));
    });
    act(() => {
      overlay.dispatchEvent(pointer('pointerup', 100, 100));
    });

    expect(calls).toEqual([10]);
    expect(markerCalls).toEqual([]);
  });

  it('swaps ripple and single while Option is held, and reports ⌘ as no-snap', () => {
    const calls: Array<[number, DragMode | undefined, { snap: boolean } | undefined]> = [];
    act(() => {
      root.render(
        <Harness dragAll onMarkerDrag={(t, mode, mods) => calls.push([t, mode, mods])} />
      );
    });

    const overlay = container.querySelectorAll('canvas')[1];

    // Marker starts at 5s * 10px/s = x50, below the label band. dragAll is
    // true, so holding Option for this move should swap the ripple default
    // to a single-marker drag, and no metaKey means snapping stays on.
    act(() => {
      overlay.dispatchEvent(pointer('pointerdown', 50, 100));
    });
    act(() => {
      overlay.dispatchEvent(pointer('pointermove', 100, 100, { altKey: true }));
    });
    act(() => {
      overlay.dispatchEvent(pointer('pointerup', 100, 100));
    });
    expect(calls).toEqual([[10, 'single', { snap: true }]]);

    calls.length = 0;
    // The marker is now at 10s (x100 at 10px/s). This time hold ⌘ with no
    // Option: ripple stays the dragAll default ('all-after'), and snap flips off.
    act(() => {
      overlay.dispatchEvent(pointer('pointerdown', 100, 100));
    });
    act(() => {
      overlay.dispatchEvent(pointer('pointermove', 150, 100, { metaKey: true }));
    });
    act(() => {
      overlay.dispatchEvent(pointer('pointerup', 150, 100));
    });
    expect(calls).toEqual([[15, 'all-after', { snap: false }]]);
  });
});
