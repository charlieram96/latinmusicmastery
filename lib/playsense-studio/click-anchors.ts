/** Confirmed click starts are absolute audio positions, independent of score edits. */
export type ClickAnchor = {id:string; seconds:number};
export function readClickAnchors(params: unknown): ClickAnchor[] | undefined {
 const raw=(params as {clickAnchors?:unknown}|null)?.clickAnchors;
 if(!Array.isArray(raw))return undefined;
 return raw.filter((a):a is ClickAnchor=>!!a&&typeof a.id==='string'&&typeof a.seconds==='number'&&Number.isFinite(a.seconds)&&a.seconds>=0)
  .map(a=>({...a})).sort((a,b)=>a.seconds-b.seconds);
}
export function addClickAnchor(anchors:ClickAnchor[],anchor:ClickAnchor):ClickAnchor[]{
 if(anchors.some(a=>Math.abs(a.seconds-anchor.seconds)<.001))return anchors;
 return [...anchors,anchor].sort((a,b)=>a.seconds-b.seconds);
}
/** No pulse precedes the first anchor. Each later anchor starts a new phase,
 * without rounding its position or changing any earlier confirmed start. */
export function anchoredClickGrid(anchors:ClickAnchor[],bpm:number,denominator:number,from:number,to:number):number[]{
 const period=60/bpm*4/denominator;
 if(!(period>0)||!Number.isFinite(period)||!Number.isFinite(to)||to<=from)return [];
 const sorted=[...anchors].sort((a,b)=>a.seconds-b.seconds),result:number[]=[];
 for(let i=0;i<sorted.length;i++){
  const start=sorted[i].seconds,end=Math.min(to,sorted[i+1]?.seconds??to);
  for(let n=Math.max(0,Math.ceil((from-start-1e-7)/period));start+n*period<end-1e-7;n++)result.push(start+n*period);
 }
 return result;
}

/** Anchors outside a section must not start an implicit click in that section. */
export function sectionClickAnchors(anchors:ClickAnchor[],start:number):ClickAnchor[]{
 return anchors.filter(a=>a.seconds>=start-1e-7);
}
