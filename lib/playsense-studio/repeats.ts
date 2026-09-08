import type { ScoreDocument, Track } from '@/components/playsense-studio/shared/score-model/types';
import { measureLengthInQN, qnToMs, walkMeasures } from './time-mapping';

/** Only collapse complete, contiguous groups with identical notation per pass. */
export function repeatGroups(track: Track) {
  const groups: Array<{ id: string; start: number; length: number; count: number }> = [];
  const content = (i: number) => {
    const { number: _number, repeat: _repeat, ...notation } = track.measures[i];
    return JSON.stringify(notation);
  };
  track.measures.forEach((m, start) => {
    const r = m.repeat;
    if (!r || r.pass !== 0 || r.offset !== 0) return;
    if (r.length * r.count > track.measures.length - start) return;
    for (let i = 0; i < r.length * r.count; i++) {
      const other = track.measures[start + i].repeat;
      if (!other || other.id !== r.id || other.length !== r.length || other.count !== r.count ||
        other.pass !== Math.floor(i / r.length) || other.offset !== i % r.length ||
        content(start + i) !== content(start + i % r.length)) return;
    }
    groups.push({ id: r.id, start, length: r.length, count: r.count });
  });
  return groups;
}

/** Student layout is compact; playback and video timing remain fully expanded. */
export function repeatProjection(score: ScoreDocument, trackIndex: number) {
  const track = score.tracks[trackIndex];
  if (!track) return null;
  const groups = repeatGroups(track);
  if (!groups.length) return null;
  const sourceIndices = track.measures.map((_, i) => {
    const group = groups.find(g => i >= g.start && i < g.start + g.length * g.count);
    return group ? group.start + (i - group.start) % group.length : i;
  });
  const visible = track.measures.flatMap((m, i) => sourceIndices[i] === i ? [m] : []);
  const compact = { ...score, tracks: score.tracks.map((t, i) => i === trackIndex ? { ...t, measures: visible } : t) };
  const original = [...walkMeasures(track, score)];
  const displayed = [...walkMeasures(compact.tracks[trackIndex], compact)];
  const rows = original.map((row, i) => {
    const target = displayed.find(d => d.measure === track.measures[sourceIndices[i]])!;
    const qnLength = measureLengthInQN(row.state.timeSignature);
    return {
      originalMs: row.state.cumulativeMs, originalQN: row.state.cumulativeQN,
      compactMs: target.state.cumulativeMs, compactQN: target.state.cumulativeQN,
      durationMs: qnToMs(qnLength, row.state.tempo), qnLength,
      measure: row.measure.number,
      repeat: row.measure.repeat,
    };
  });
  const end = rows[rows.length - 1];
  const originalDuration = end.originalMs + end.durationMs;
  const compactDuration = end.compactMs + end.durationMs;
  const toCompactMs = (ms: number) => {
    if (ms >= originalDuration) return compactDuration + ms - originalDuration;
    const row = rows.find(r => ms < r.originalMs + r.durationMs) ?? rows[0];
    return row.compactMs + ms - row.originalMs;
  };
  const toOriginalQN = (qn: number, atMs: number, endBoundary = false) => {
    const candidates = rows.filter(r => endBoundary
      ? qn > r.compactQN && qn <= r.compactQN + r.qnLength
      : qn >= r.compactQN && qn < r.compactQN + r.qnLength);
    const current = rows.find(r => atMs >= r.originalMs && atMs < r.originalMs + r.durationMs);
    const row = candidates.find(r => current?.repeat && r.repeat?.id === current.repeat.id && r.repeat?.pass === current.repeat.pass) ??
      candidates.find(r => atMs >= r.originalMs && atMs < r.originalMs + r.durationMs) ??
      candidates.reduce<(typeof rows)[number] | undefined>((best, r) => !best || Math.abs(r.originalMs - atMs) < Math.abs(best.originalMs - atMs) ? r : best, undefined);
    return row ? { qn: row.originalQN + qn - row.compactQN, measure: row.measure } :
      { qn: end.originalQN + end.qnLength, measure: end.measure };
  };
  return { score: compact, rows, originalDuration, toCompactMs, toOriginalQN };
}
