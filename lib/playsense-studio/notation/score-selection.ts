/** Pointer selection over the engraved score; never changes pitch or timing. */
export interface ScoreHit {
  id: string;
  kind: 'note' | 'measure';
  track: number;
  measure: number;
  voice?: number;
  event?: number;
  member?: number;
  highlightHeight?: number;
  /** Paint separate bands while keeping the whole measure clickable. */
  highlightRegions?: {x?:number;width?:number;y:number;height:number}[];
  x: number; y: number; width: number; height: number;
}
export function hitsInBox(hits: ScoreHit[], kind: ScoreHit['kind'], x1: number, y1: number, x2: number, y2: number) {
  const left = Math.min(x1, x2), right = Math.max(x1, x2), top = Math.min(y1, y2), bottom = Math.max(y1, y2);
  return hits.filter(h => h.kind === kind && h.x + h.width >= left && h.x <= right && h.y + h.height >= top && h.y <= bottom);
}

type SelectionBox = {left:number;top:number;width:number;height:number};
const selectionAnchors = new WeakMap<Set<string>, string>();
const selectionBoxes = new WeakMap<HTMLElement, SelectionBox>();

export function installScoreSelection(surface: HTMLElement, hits: ScoreHit[], selected: Set<string>, change: (hits: ScoreHit[]) => void, options: { measureHeaderHeight?: number; onInput?: (hit: ScoreHit, line: number) => boolean } = {}) {
  const controls = new Map<string, HTMLButtonElement>();
  const highlights = new Map<string, HTMLDivElement[]>();
  const paint = () => controls.forEach((b, id) => {
    const on = selected.has(id);
    b.setAttribute('aria-pressed', String(on));
    const highlight = highlights.get(id);
    highlight?.forEach(area => { area.style.display = on ? 'block' : 'none'; });
    const bands = hits.find(h => h.id === id)?.highlightRegions;
    b.style.background = on && !bands ? 'rgba(59,130,246,.25)' : 'transparent';
    b.style.boxShadow = on && !bands ? '0 0 0 1px #3b82f6' : 'none';
  });
  const report = () => { paint(); change(hits.filter(h => selected.has(h.id))); };
  const selectHit = (hit: ScoreHit | undefined, shift: boolean, additive: boolean) => {
    if (!hit) { if (!additive && !shift) {selected.clear();selectionAnchors.delete(selected);} return; }
    const anchor = selected.size ? hits.find(h=>h.id===selectionAnchors.get(selected)) : undefined;
    if (shift && anchor?.kind===hit.kind) {
      if(!additive) selected.clear();
      const order=(a:ScoreHit,b:ScoreHit)=>a.measure-b.measure || (a.event??0)-(b.event??0) || (a.voice??0)-(b.voice??0) || (a.member??0)-(b.member??0);
      const [first,last]=order(anchor,hit)<=0?[anchor,hit]:[hit,anchor];
      hits.filter(h=>h.kind===hit.kind && h.track>=Math.min(anchor.track,hit.track) && h.track<=Math.max(anchor.track,hit.track) && order(h,first)>=0 && order(h,last)<=0).forEach(h=>selected.add(h.id));
    } else {
      if(!additive) selected.clear();
      if(additive && selected.has(hit.id)) selected.delete(hit.id); else selected.add(hit.id);
      selectionAnchors.set(selected,hit.id);
    }
  };
  for (const hit of hits) {
    const b = document.createElement('button'); b.type = 'button';
    b.dataset.scoreSelection = hit.id;
    b.setAttribute('aria-label', hit.kind === 'measure' ? `Select staff ${hit.track + 1}, measure ${hit.measure + 1}` : `Select staff ${hit.track + 1}, measure ${hit.measure + 1}, voice ${(hit.voice ?? 0) + 1}, note ${(hit.event ?? 0) + 1}, pitch ${(hit.member ?? 0) + 1}`);
    Object.assign(b.style, { position: 'absolute', left: `${hit.x}px`, top: `${hit.y}px`, width: `${hit.width}px`, height: `${hit.height}px`, borderRadius: '3px', cursor: 'pointer', zIndex: hit.kind === 'note' ? '2' : '1' });
    b.addEventListener('click', e => {
      // Pointer selection is handled below; keyboard activation has detail 0.
      if (e.detail !== 0) return;
      selectionBoxes.delete(surface); marquee.style.display = 'none';
      selectHit(hit,e.shiftKey,e.metaKey); report();
    });
    const regions=hit.highlightRegions ?? (hit.highlightHeight ? [{y:hit.y,height:hit.highlightHeight}] : []);
    const areas=regions.map(region => {
      const area=document.createElement('div');
      area.dataset.scoreHighlight=hit.id;
      Object.assign(area.style,{position:'absolute',pointerEvents:'none',left:`${region.x ?? hit.x}px`,top:`${region.y}px`,width:`${region.width ?? hit.width}px`,height:`${region.height}px`,background:'#3b82f626',border:'1px solid #3b82f6',display:'none'});
      surface.appendChild(area);
      return area;
    });
    if(areas.length) highlights.set(hit.id,areas);
    surface.appendChild(b); controls.set(hit.id, b);
  }
  paint();
  const marquee = document.createElement('div');
  Object.assign(marquee.style, { position: 'absolute', pointerEvents: 'none', border: '1px solid #3b82f6', background: '#3b82f626', display: 'none', zIndex: '3' });
  surface.appendChild(marquee);
  const showBox = (box: SelectionBox) => Object.assign(marquee.style, {display:'block',left:`${box.left}px`,top:`${box.top}px`,width:`${box.width}px`,height:`${box.height}px`});
  const savedBox=selectionBoxes.get(surface);
  if(savedBox && selected.size) showBox(savedBox);
  let drag: { kind: ScoreHit['kind']; x: number; y: number; id: number; hit?: ScoreHit; base: string[]; shift: boolean; additive: boolean; moved: boolean } | null = null;
  const point = (e: PointerEvent) => { const r = surface.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || e.ctrlKey || e.pointerType === 'touch') return;
    const target = (e.target as Element).closest<HTMLElement>('[data-score-selection]');
    let hit = hits.find(h => h.id === target?.dataset.scoreSelection);
    const p=point(e);
    // Only painted bands select a measure. The blank space between them
    // remains a place to clear selection or start a note-selection rectangle.
    if (hit?.kind !== 'note' && options.measureHeaderHeight !== undefined) {
      const bars=hits.filter(h=>h.kind==='measure');
      const band=bars.find(h=>h.highlightRegions?.some(r=>
        p.x>=(r.x??h.x) && p.x<(r.x??h.x)+(r.width??h.width) &&
        p.y>=r.y && p.y<=r.y+r.height));
      if(band) hit=band;
      else if(hit?.highlightRegions) hit=undefined;
    }
    if (hit && !e.shiftKey && !e.metaKey && options.onInput) {
      const bar = hits.find(h => h.kind === 'measure' && h.track === hit!.track && h.measure === hit!.measure);
      const staff = bar?.highlightRegions?.at(-1) ?? bar;
      if (staff && p.y >= staff.y - 20 && p.y <= staff.y + staff.height + 20 &&
          options.onInput(hit, (p.y - staff.y) * 4 / staff.height)) {
        selected.clear(); selected.add(hit.id); paint();
        e.preventDefault(); e.stopPropagation(); return;
      }
    }
    const kind=hit?.kind==='measure' && (options.measureHeaderHeight===undefined || p.y<=hit.y+options.measureHeaderHeight) ? 'measure' : 'note';
    selectionBoxes.delete(surface); marquee.style.display='none';
    drag = { ...p, kind, id: e.pointerId, hit, base: e.metaKey || e.shiftKey ? [...selected] : [], shift: e.shiftKey, additive: e.metaKey, moved: false };
    surface.setPointerCapture?.(e.pointerId);
    e.preventDefault();
  };
  const move = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const p = point(e);
    if (Math.hypot(p.x - drag.x, p.y - drag.y) < 4 && !drag.moved) return;
    drag.moved = true;
    Object.assign(marquee.style, { display: 'block', left: `${Math.min(p.x,drag.x)}px`, top: `${Math.min(p.y,drag.y)}px`, width: `${Math.abs(p.x-drag.x)}px`, height: `${Math.abs(p.y-drag.y)}px` });
    selected.clear(); drag.base.forEach(id => selected.add(id));
    const left=Math.min(drag.x,p.x),right=Math.max(drag.x,p.x);
    const top=Math.min(drag.y,p.y),bottom=Math.max(drag.y,p.y);
    // A rectangle enclosing the staff band from barline to barline selects
    // the whole measure. Partial rectangles continue to select noteheads.
    const complete=drag.kind==='note' ? hits.filter(h=>h.kind==='measure' && h.highlightRegions?.some(r=>
      r.x!==undefined && left<=r.x+2 && right>=r.x+(r.width??h.width)-2 && top<=r.y+2 && bottom>=r.y+r.height-2)) : [];
    complete.forEach(h=>selected.add(h.id));
    hitsInBox(hits, drag.kind, drag.x, drag.y, p.x, p.y)
      .filter(h=>!complete.some(bar=>bar.track===h.track && bar.measure===h.measure))
      .forEach(h=>selected.add(h.id));
    if(complete.length && !hits.some(h=>h.kind==='note' && selected.has(h.id))) marquee.style.display='none';
    paint();
  };
  const up = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    if (!drag.moved) selectHit(drag.hit,drag.shift,drag.additive);
    else if(drag.hit) selectionAnchors.set(selected,drag.hit.id);
    if (drag.moved && drag.kind==='note' && hits.some(h=>h.kind==='note' && selected.has(h.id))) {
      const p=point(e);
      selectionBoxes.set(surface,{left:Math.min(p.x,drag.x),top:Math.min(p.y,drag.y),width:Math.abs(p.x-drag.x),height:Math.abs(p.y-drag.y)});
    } else { marquee.style.display='none'; selectionBoxes.delete(surface); }
    surface.releasePointerCapture?.(e.pointerId);
    drag = null; report();
  };
  const cancel = () => { drag = null; marquee.style.display = 'none'; };
  const outside = (e: PointerEvent) => { if (!(e.target as Element).closest?.('[role="toolbar"], [data-score-preserve-selection]') && !surface.contains(e.target as Node)) { selectionBoxes.delete(surface); marquee.style.display='none'; selected.clear(); selectionAnchors.delete(selected); report(); } };
  const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { selectionBoxes.delete(surface); marquee.style.display='none'; selected.clear(); selectionAnchors.delete(selected); report(); } };
  surface.style.userSelect = 'none';
  surface.addEventListener('pointerdown', down); surface.addEventListener('pointermove', move); surface.addEventListener('pointerup', up); surface.addEventListener('pointercancel', cancel);
  document.addEventListener('pointerdown', outside); document.addEventListener('keydown', key);
  return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', key); surface.removeEventListener('pointerdown', down); surface.removeEventListener('pointermove', move); surface.removeEventListener('pointerup', up); surface.removeEventListener('pointercancel', cancel); };
}
