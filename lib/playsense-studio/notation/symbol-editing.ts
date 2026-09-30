import type { SymbolOffset, SymbolTarget } from './symbol-layout';
/** Capture before note hit areas: a symbol drag must never select/delete a note. */
export function installSymbolEditing(root: HTMLElement, edit: (target: SymbolTarget, offset?: SymbolOffset, remove?: boolean) => void) {
  let selected: SVGGElement | null = null;
  let selectionKey: string | null = null;
  let suppressClick = false;
  let drag: { group: SVGGElement; id: number; start: DOMPoint; offset: SymbolOffset; inverse: DOMMatrix; moved: boolean } | null = null;
  const clear = () => { selected?.style.removeProperty('filter'); selected = null; selectionKey = null; };
  const target = (g: SVGGElement): SymbolTarget => JSON.parse(g.dataset.notationSymbol!);
  const down = (e: PointerEvent) => {
    if (e.button !== 0 || e.ctrlKey || e.pointerType === 'touch') return;
    const candidates = [...root.querySelectorAll<SVGGElement>('[data-notation-symbol]')].filter(g => {
      const r = g.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && e.clientX >= r.left - 3 && e.clientX <= r.right + 3 && e.clientY >= r.top - 3 && e.clientY <= r.bottom + 3;
    }).sort((a,b) => { const x=a.getBoundingClientRect(),y=b.getBoundingClientRect(); return x.width*x.height-y.width*y.height; });
    const group = candidates[0];
    suppressClick = !!group;
    clear();
    if (!group) return;
    const matrix = (group.parentNode as SVGGraphicsElement).getScreenCTM?.();
    if (!matrix) return;
    e.preventDefault(); e.stopImmediatePropagation();
    selected = group; selectionKey=group.dataset.notationSymbol!; selected.style.filter = 'drop-shadow(0 0 3px #f59e0b) drop-shadow(0 0 1px #f59e0b)';
    const inverse = matrix.inverse();
    drag = {group, id:e.pointerId, start:new DOMPoint(e.clientX,e.clientY).matrixTransform(inverse), inverse, offset:{x:Number(group.dataset.offsetX),y:Number(group.dataset.offsetY)}, moved:false};
    root.setPointerCapture?.(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const p = new DOMPoint(e.clientX,e.clientY).matrixTransform(drag.inverse);
    const dx=p.x-drag.start.x,dy=p.y-drag.start.y;
    if (Math.hypot(dx,dy)>1) drag.moved=true;
    drag.group.setAttribute('transform',`translate(${drag.offset.x+dx} ${drag.offset.y+dy})`);
  };
  const up = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const d=drag; drag=null;
    root.releasePointerCapture?.(e.pointerId);
    if (d.moved) {
      const p=new DOMPoint(e.clientX,e.clientY).matrixTransform(d.inverse);
      edit(target(d.group),{x:d.offset.x+p.x-d.start.x,y:d.offset.y+p.y-d.start.y});
    }
  };
  const cancel = () => { if(drag) drag.group.setAttribute('transform',`translate(${drag.offset.x} ${drag.offset.y})`); drag=null; };
  const observer = new MutationObserver(() => {
    if (!selectionKey || selected?.isConnected) return;
    selected = [...root.querySelectorAll<SVGGElement>('[data-notation-symbol]')].find(g=>g.dataset.notationSymbol===selectionKey) ?? null;
    if (selected) selected.style.filter='drop-shadow(0 0 3px #f59e0b)';
  });
  observer.observe(root,{childList:true,subtree:true});
  const key = (e: KeyboardEvent) => {
    if (!selected?.isConnected || (e.target as Element).closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if (e.key==='Escape') { cancel(); clear(); return; }
    if (e.key==='Delete'||e.key==='Backspace') {
      e.preventDefault(); e.stopImmediatePropagation();
      const t=target(selected); clear(); edit(t,undefined,true);
    }
  };
  const outside = (e: PointerEvent) => { if (!root.contains(e.target as Node)) clear(); };
  const click = (e: MouseEvent) => { if (suppressClick) { e.preventDefault(); e.stopImmediatePropagation(); suppressClick=false; } };
  root.addEventListener('click',click,true);
  root.addEventListener('pointerdown',down,true); root.addEventListener('pointermove',move,true); root.addEventListener('pointerup',up,true); root.addEventListener('pointercancel',cancel,true);
  window.addEventListener('keydown',key,true); document.addEventListener('pointerdown',outside,true);
  return () => { observer.disconnect(); cancel(); clear(); root.removeEventListener('click',click,true); root.removeEventListener('pointerdown',down,true); root.removeEventListener('pointermove',move,true); root.removeEventListener('pointerup',up,true); root.removeEventListener('pointercancel',cancel,true); window.removeEventListener('keydown',key,true); document.removeEventListener('pointerdown',outside,true); };
}
