import type { RenderContext } from 'vexflow';
export type SymbolOffset = { x: number; y: number };
export type SymbolTarget = { eventId?: string; spanId?: string; symbol: string };
/** Model-space offsets, independent of desk zoom and timeline scaling. */
export function symbolGroup(ctx: RenderContext, target: SymbolTarget, offset: SymbolOffset | undefined, draw: () => void) {
  const group = ctx.openGroup('editable-symbol');
  if (group) {
    group.setAttribute('data-notation-symbol', JSON.stringify(target));
    group.setAttribute('data-offset-x', String(offset?.x ?? 0));
    group.setAttribute('data-offset-y', String(offset?.y ?? 0));
    group.setAttribute('transform', `translate(${offset?.x ?? 0} ${offset?.y ?? 0})`);
  }
  try { draw(); } finally { ctx.closeGroup(); }
}
