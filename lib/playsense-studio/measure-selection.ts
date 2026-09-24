// PlaySense Studio — which bars are selected in the measure strip. An anchor
// (where the selection started) and a focus (the end being moved by ⇧-click,
// drag or ⇧-arrows). Pure, so the rules are tested apart from the UI.

export interface MeasureSelection { anchor: number; focus: number }

export function selectionBounds(sel: MeasureSelection | null): [number, number] | null {
  return sel ? [Math.min(sel.anchor, sel.focus), Math.max(sel.anchor, sel.focus)] : null;
}

export function clickSelect(sel: MeasureSelection | null, index: number, extend: boolean): MeasureSelection {
  return extend && sel ? { anchor: sel.anchor, focus: index } : { anchor: index, focus: index };
}

export function dragSelect(anchor: number, index: number): MeasureSelection {
  return { anchor, focus: index };
}

export function stepSelection(
  sel: MeasureSelection | null,
  delta: number,
  extend: boolean,
  count: number
): MeasureSelection | null {
  if (count <= 0) return null;
  if (!sel) return { anchor: 0, focus: 0 };
  const focus = Math.max(0, Math.min(count - 1, sel.focus + delta));
  return extend ? { anchor: sel.anchor, focus } : { anchor: focus, focus };
}

export function clampSelection(sel: MeasureSelection | null, count: number): MeasureSelection | null {
  if (!sel || count <= 0) return null;
  const anchor = Math.min(sel.anchor, count - 1);
  const focus = Math.min(sel.focus, count - 1);
  return anchor === sel.anchor && focus === sel.focus ? sel : { anchor: Math.min(anchor, focus), focus: Math.min(anchor, focus) };
}

export function isInSelection(sel: MeasureSelection | null, index: number): boolean {
  const b = selectionBounds(sel);
  return !!b && index >= b[0] && index <= b[1];
}

export function measureAtX(x: number, bars: Array<{ left: number; right: number }>): number | null {
  if (bars.length === 0) return null;
  if (x < bars[0].left) return 0;
  for (let i = 0; i < bars.length; i++) if (x >= bars[i].left && x < bars[i].right) return i;
  return bars.length - 1;
}
