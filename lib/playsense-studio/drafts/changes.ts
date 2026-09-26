import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { readFlex } from '@/lib/playsense-studio/flex';
import type { StudioAnchor, StudioTiming } from './timing';

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
    flex: readFlex(t.params).map((f) => [round(f.src), round(f.dst), f.anchor]),
    waypoints: t.waypoints.map((w) => [round(w.musicalPositionQN), round(w.videoTimeSeconds)]),
  });
const anchorCanon = (a: StudioAnchor | null) =>
  a ? canon([round(a.seconds), a.qn == null ? null : round(a.qn)]) : 'null';
const playCanon = (p: StudioTiming['play']) =>
  p ? canon([p.bar1Seconds == null ? null : round(p.bar1Seconds), p.countInBars, p.preroll]) : 'null';

/** publishTimeMap seeds/rebases the live anchor itself, and the Studio UI never
 *  clears one — it only sets one. So a null draft anchor means "never touched",
 *  not "cleared": it's never a change, and (in publishStudioDraft) never written. */
export function anchorChanged(live: StudioAnchor | null, draft: StudioAnchor | null): boolean {
  return draft != null && anchorCanon(draft) !== anchorCanon(live);
}

export function diffParts(live: StudioContent, draft: StudioContent) {
  return {
    score: canon(live.score) !== canon(draft.score),
    // Fewer than two waypoints can't publish (publishTimeMap requires at least
    // two), so a draft that thin is never "changed" timing.
    timing: draft.timing.waypoints.length >= 2 && timingCanon(live.timing) !== timingCanon(draft.timing),
    anchor: anchorChanged(live.timing.anchor, draft.timing.anchor),
    // Graded owners (EXERCISE, JAM_SESSION) only: bar 1 + count-in/pre-roll.
    // Both sides are undefined for every other owner, so this is never a
    // phantom change there.
    play: playCanon(live.timing.play) !== playCanon(draft.timing.play),
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
  if (parts.play) lines.push('Play-along timing changed');
  if (!lines.length && parts.score) lines.push('Score details changed');
  return lines.length ? lines : ['No changes from the live version'];
}
