// PlaySense Studio — closing barlines.
//
// A scored section ends with a final (thin–thick) bar, like the last measure of
// a piece of sheet music. Authors can remove it or place one on an inner
// measure; the override lives on Measure.endBarline. Repeat barlines are
// decided by the renderers and take precedence over this.

import type { Measure } from '@/components/playsense-studio/shared/score-model/types';

/** True when the measure at `index` should close with a final bar. */
export function hasFinalBarline(measures: readonly Measure[], index: number): boolean {
  const measure = measures[index];
  if (!measure) return false;
  if (measure.endBarline) return measure.endBarline === 'final';
  return index === measures.length - 1;
}
