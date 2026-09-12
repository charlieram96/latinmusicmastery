// Draws one track of a RowPlan as a list of standalone row SVGs. Mirrors the
// draw loop in the player's staff renderer (stave, barlines, clef + time
// signature on row 0, formatted voice, beams, ties across rows) without any of
// its interactive layers.
import { Renderer, Stave, StaveTie, BarlineType, type StaveNote } from 'vexflow';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { extractTrackEvents, scoreTieIndices, type VexEventDescriptor } from '@/lib/playsense-studio/score-to-vexflow';
import { formatMeasureVoice } from '@/components/playsense-studio/player/notation/renderers/staff-renderer';
import { hasFinalBarline } from '@/lib/playsense-studio/barlines';
import { MEASURE_WIDTH } from '@/lib/playsense-studio/notation-layout';
import type { RowPlan, RowPlanRow } from './row-plan';

export const PRINT_PADDING_X = 12;
/** VexFlow's Stave draws its five lines 40px below the stave's y, spanning 40px. */
const STAFF_LINE_TOP = 40;
const STAFF_LINE_SPAN = 40;
const ROW_TOP_PAD = 8;
const ROW_BOTTOM_PAD = 12;

export interface EngravedRow {
  svg: SVGSVGElement;
  width: number;
  height: number;
  firstMeasureNumber: number;
  staffTopY: number;
}

export interface EngravedTrack {
  trackIndex: number;
  displayName: string;
  rows: EngravedRow[];
  rowHeight: number;
}

/** Vertical room ledger notes need above and below the staff, in model px. */
function ledgerExtents(blocks: ReturnType<typeof extractTrackEvents>): { above: number; below: number } {
  const headYs = blocks.flatMap(block => block.events.flatMap(event => event.keys.map(key => {
    const match = /^([a-g])(?:#|b)?\/(-?\d+)$/.exec(key);
    if (!match) return 60;
    const step = Number(match[2]) * 7 + 'cdefgab'.indexOf(match[1]);
    return 80 - (step - 30) * 5; // same grid as the staff renderer: 5px per diatonic step
  })));
  if (headYs.length === 0) return { above: 0, below: 0 };
  return {
    above: Math.max(0, STAFF_LINE_TOP - 8 - Math.min(...headYs)),
    below: Math.max(0, Math.max(...headYs) - (STAFF_LINE_TOP + STAFF_LINE_SPAN) + 8),
  };
}

function rowsFor(plan: RowPlan, trackIndex: number): RowPlanRow[] {
  return plan.aligned ? plan.rows : plan.perTrackRows[trackIndex];
}

export function engraveTrackRows(plan: RowPlan, trackIndex: number): EngravedTrack {
  const score: ScoreDocument = plan.score;
  const track = score.tracks[trackIndex];
  const blocks = extractTrackEvents(track, score.initialTimeSignature, score.initialKeyFifths);
  const rows = rowsFor(plan, trackIndex);
  const { above, below } = ledgerExtents(blocks);
  const staveY = ROW_TOP_PAD + above;
  const rowHeight = staveY + STAFF_LINE_TOP + STAFF_LINE_SPAN + below + ROW_BOTTOM_PAD;
  const width = plan.availWidth + 2 * PRINT_PADDING_X;

  // Notes are kept across rows so ties can be split at row turns.
  let previous: { vexNote: StaveNote; descriptor: VexEventDescriptor } | null = null;
  let pendingTie: { indices: ReturnType<typeof scoreTieIndices>; descriptor: VexEventDescriptor } | null = null;
  let previousRowIndex = -1;

  const engraved: EngravedRow[] = rows.map((row, rowIndex) => {
    const host = document.createElement('div');
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(width, rowHeight);
    const ctx = renderer.getContext();

    let x = PRINT_PADDING_X;
    row.widths.forEach((measureWidth, col) => {
      const blockIndex = row.startIndex + col;
      const block = blocks[blockIndex];
      const showHeader = blockIndex === 0;
      const stave = new Stave(x, staveY, measureWidth);
      const repeat = block.measure.repeat;
      if (repeat?.offset === 0) stave.setBegBarType(BarlineType.REPEAT_BEGIN);
      if (repeat && repeat.offset === repeat.length - 1) stave.setEndBarType(BarlineType.REPEAT_END);
      else if (hasFinalBarline(track.measures, blockIndex)) stave.setEndBarType(BarlineType.END);
      // Every printed row restates the clef (once, at the row's first measure);
      // only the true first row also carries the time signature.
      if (col === 0) stave.addClef(block.clef);
      if (showHeader) stave.addTimeSignature(`${block.timeSignature[0]}/${block.timeSignature[1]}`);
      else if (col === 0) stave.setNoteStartX(stave.getNoteStartX() + 8);
      stave.setContext(ctx).draw();

      const justify = measureWidth - (showHeader ? MEASURE_WIDTH.FIRST_MEASURE_EXTRA_WIDTH : 0) - 20;
      const laid = formatMeasureVoice(block.events, block.timeSignature, justify, block.clef);
      if (laid) {
        laid.voice.draw(ctx, stave);
        laid.beams.forEach(beam => beam.setContext(ctx).draw());
        laid.vexNotes.forEach((vexNote, idx) => {
          const descriptor = block.events[idx];
          if (pendingTie) {
            // Second half of a tie that started on the previous row.
            new StaveTie({ lastNote: vexNote, firstIndexes: pendingTie.indices.lastIndexes, lastIndexes: pendingTie.indices.lastIndexes }).setContext(ctx).draw();
            pendingTie = null;
          }
          if (previous) {
            const indices = scoreTieIndices(previous.descriptor, descriptor);
            if (indices.firstIndexes.length) {
              if (previous.vexNote.getStave() === stave || previousRowIndex === rowIndex) {
                new StaveTie({ firstNote: previous.vexNote, lastNote: vexNote, ...indices }).setContext(ctx).draw();
              }
            }
          }
          previous = { vexNote, descriptor };
          previousRowIndex = rowIndex;
        });
      }
      x += measureWidth;
    });

    // A tie leaving this row: draw its first half now, remember the rest.
    if (previous && blocks[row.startIndex + row.widths.length]) {
      const nextDescriptor = blocks[row.startIndex + row.widths.length].events[0];
      if (nextDescriptor) {
        const indices = scoreTieIndices(previous.descriptor, nextDescriptor);
        if (indices.firstIndexes.length) {
          new StaveTie({ firstNote: previous.vexNote, firstIndexes: indices.firstIndexes, lastIndexes: indices.firstIndexes }).setContext(ctx).draw();
          pendingTie = { indices, descriptor: nextDescriptor };
        }
      }
    }

    const svg = host.querySelector('svg') as SVGSVGElement;
    svg.setAttribute('width', String(width));
    svg.setAttribute('height', String(rowHeight));
    svg.setAttribute('viewBox', `0 0 ${width} ${rowHeight}`);
    return { svg, width, height: rowHeight, firstMeasureNumber: blocks[row.startIndex].measure.number, staffTopY: staveY + STAFF_LINE_TOP };
  });

  return { trackIndex, displayName: track.displayName, rows: engraved, rowHeight };
}
