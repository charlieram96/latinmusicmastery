import type { MarkerState } from '@/components/playsense-studio/sync/marker-model';

/** Stretch the selected bars together; later bars retain their durations. */
export function resizeMarkerRange(state: MarkerState, start: number, end: number, proposedEnd: number, limit = Infinity): MarkerState {
  const first = state.measures[start], last = state.measures[end];
  if (!first || !last || start > end || !Number.isFinite(proposedEnd)) return state;
  const a = first.beats[0].videoTimeSeconds;
  const b = state.measures[end+1]?.beats[0].videoTimeSeconds ?? state.tailVideoTimeSeconds;
  if (b <= a) return state;
  const minDuration = state.measures.slice(start,end+1).reduce((n,m)=>n+m.beats.length,0) * .01;
  const maxEnd = limit - (state.tailVideoTimeSeconds-b);
  if (maxEnd < a+minDuration) return state;
  const next = Math.max(a+minDuration,Math.min(maxEnd,proposedEnd));
  const ratio = (next-a)/(b-a), delta = next-b;
  if (Math.abs(delta)<1e-9) return state;
  return {...state,tailVideoTimeSeconds:state.tailVideoTimeSeconds+delta,
    measures:state.measures.map((m,i)=> i<start ? m : {...m,
      beats:m.beats.map(beat=>({...beat,videoTimeSeconds:i<=end ? a+(beat.videoTimeSeconds-a)*ratio : beat.videoTimeSeconds+delta})),
      nudges:i<=end ? m.nudges.map(n=>({...n,deltaSeconds:n.deltaSeconds*ratio})) : m.nudges,
    })};
}
