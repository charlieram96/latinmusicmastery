// PlaySense Studio — the in-app measure clipboard (module store).
//
// Lives outside React so a copy made in one section can be pasted into another
// section of the same class item. It is not the OS clipboard and does not
// survive a reload. Subscribers (useSyncExternalStore) re-render on write.

import type { MeasureClip } from './measure-edits';

let clip: MeasureClip | null = null;
const listeners = new Set<() => void>();

export function writeMeasureClipboard(next: MeasureClip): void {
  const measures = (JSON.parse(JSON.stringify(next.measures)) as MeasureClip['measures']).map((m) => {
    const { repeat: _repeat, endBarline: _end, ...rest } = m;
    return rest;
  });
  clip = {
    measures,
    context: { ...next.context, timeSignature: [next.context.timeSignature[0], next.context.timeSignature[1]] },
    instrument: next.instrument,
    spans: next.spans ? (JSON.parse(JSON.stringify(next.spans)) as MeasureClip['spans']) : undefined,
  };
  for (const cb of listeners) cb();
}

export function readMeasureClipboard(): MeasureClip | null {
  return clip;
}

export function subscribeMeasureClipboard(cb: () => void): () => void {
  listeners.add(cb);
  return () => { listeners.delete(cb); };
}
