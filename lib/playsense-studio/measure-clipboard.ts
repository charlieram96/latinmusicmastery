// PlaySense Studio — the in-app measure clipboard (module store).
//
// Lives outside React so a copy made in one section can be pasted into another
// section of the same class item. It is not the OS clipboard and does not
// survive a reload. Subscribers (useSyncExternalStore) re-render on write.

import type { Measure } from '@/components/playsense-studio/shared/score-model/types';
import type { MeasureClip } from './measure-edits';

/** Drops repeat and end-barline tags: a pasted or duplicated copy is never itself a repeat pass. */
export function stripCopyTags(m: Measure): Measure {
  const { repeat: _r, endBarline: _e, ...rest } = m;
  return rest;
}

let clip: MeasureClip | null = null;
const listeners = new Set<() => void>();

export function writeMeasureClipboard(next: MeasureClip): void {
  const measures = (JSON.parse(JSON.stringify(next.measures)) as MeasureClip['measures']).map(stripCopyTags);
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
