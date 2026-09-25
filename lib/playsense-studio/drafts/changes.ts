import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import type { StudioTiming } from './timing';

export interface StudioContent {
  score: ScoreDocument;
  timing: StudioTiming;
}

// Event and tuplet ids are assigned on open and by edits; they carry no music.
const canon = (v: unknown) => JSON.stringify(v, (k, x) => (k === 'id' ? undefined : x));
const round = (n: number) => Math.round(n * 1000) / 1000;
const timingCanon = (t: StudioTiming) =>
  canon({
    method: t.method,
    nudges: t.params.nudges ?? [],
    waypoints: t.waypoints.map((w) => [round(w.musicalPositionQN), round(w.videoTimeSeconds)]),
  });
const anchorCanon = (t: StudioTiming) =>
  t.anchor ? canon([round(t.anchor.seconds), t.anchor.qn == null ? null : round(t.anchor.qn)]) : 'null';

export function diffParts(live: StudioContent, draft: StudioContent) {
  return {
    score: canon(live.score) !== canon(draft.score),
    timing: timingCanon(live.timing) !== timingCanon(draft.timing),
    anchor: anchorCanon(live.timing) !== anchorCanon(draft.timing),
  };
}

const bars = (n: number) => `${n} ${n === 1 ? 'bar' : 'bars'}`;

/** Human lines for the Publish popover, in a fixed order. */
export function summarizeChanges(live: StudioContent, draft: StudioContent): string[] {
  const lines: string[] = [];
  if (live.score.title !== draft.score.title) lines.push('Title changed');
  const a = live.score.tracks[0]?.measures ?? [];
  const b = draft.score.tracks[0]?.measures ?? [];
  let changed = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) if (canon(a[i]) !== canon(b[i])) changed++;
  if (changed) lines.push(`${bars(changed)} changed`);
  if (b.length > a.length) lines.push(`${bars(b.length - a.length)} added`);
  if (a.length > b.length) lines.push(`${bars(a.length - b.length)} removed`);
  const parts = diffParts(live, draft);
  if (parts.timing) lines.push('Timing changed');
  if (parts.anchor) lines.push('Click anchor changed');
  if (!lines.length && parts.score) lines.push('Score details changed');
  return lines.length ? lines : ['No changes from the live version'];
}
