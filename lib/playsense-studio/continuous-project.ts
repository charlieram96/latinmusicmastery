export interface ContinuousScoreProject {
  version: 1;
  editableEmptyMeasures?: boolean;
  musicRanges?: Record<string,{start:number;end:number}>;
  title: string;
  classItemId: string;
  sectionIds: string[];
  durationSeconds: number;
  backupPath: string;
}
export function timelineGaps(ranges: {startSeconds:number|null;endSeconds:number|null}[], duration:number) {
  let cursor = 0;
  const gaps: {start:number;end:number}[] = [];
  for (const range of [...ranges].filter(r=>r.startSeconds!=null&&r.endSeconds!=null).sort((a,b)=>a.startSeconds!-b.startSeconds!)) {
    const start = Math.max(0,Math.min(duration,range.startSeconds!));
    if (start > cursor) gaps.push({start:cursor,end:start});
    cursor = Math.max(cursor,Math.min(duration,range.endSeconds!));
  }
  if (cursor < duration) gaps.push({start:cursor,end:duration});
  return gaps;
}

/** Fill an unscored span with bar-sized cells; the last cell ends at the
 * existing anchor, never moving the next musical fragment. */
export function emptyTimelineMeasures(start:number,end:number,bpm=120,timeSignature:readonly number[]=[4,4]) {
  const secondsPerBar=60/(Number.isFinite(bpm)&&bpm>0?bpm:120)*(timeSignature[0]||4)*4/(timeSignature[1]||4);
  const count=Math.ceil(Math.max(0,end-start)/secondsPerBar-1e-9);
  return Array.from({length:count},(_,i)=>({start:start+i*secondsPerBar,end:Math.min(end,start+(i+1)*secondsPerBar)}));
}
