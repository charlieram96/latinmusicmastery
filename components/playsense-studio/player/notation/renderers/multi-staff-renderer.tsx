'use client';
import {playbackTrack} from '@/lib/playsense-studio/playback-tempo';

import { measureLengthInQN, qnToMs, walkMeasures } from '@/lib/playsense-studio/time-mapping';
import { useEffect, useRef } from 'react';
import { Barline, BarlineType, Formatter, Renderer, Stave, StaveConnector, StaveTie } from 'vexflow';
import { drawSpanSegments, spanSegments, type PlacedNote } from '@/lib/playsense-studio/notation/spans';
import { extractTrackEvents, scoreTieIndices, type VexEventDescriptor } from '@/lib/playsense-studio/score-to-vexflow';
import { applyStaveHeader, buildMeasure, drawMeasure, staveHeader } from '@/lib/playsense-studio/notation/build-measure';
import { hasFinalBarline } from '@/lib/playsense-studio/barlines';
import { repeatGroups } from '@/lib/playsense-studio/repeats';
import { staffGroupIndices } from '@/lib/playsense-studio/staff-groups';
import { installScoreSelection, type ScoreHit } from '@/lib/playsense-studio/notation/score-selection';
import type { StaffRendererProps } from './staff-renderer';

export interface MultiStaffRendererProps extends StaffRendererProps {
  pages?: boolean;
  onSelectionChange?: (hits: ScoreHit[]) => void;
  onNoteInput?: (hit: ScoreHit, line: number) => boolean;
  onSelectMeasure?: (trackIndex: number, measureIndex: number) => void;
}

/** Shared engraving and selection of each staff without changing the zoom. */
export function MultiStaffRenderer(props: MultiStaffRendererProps) {
  const host = useRef<HTMLDivElement>(null);
  const cursor = useRef<HTMLDivElement | null>(null);
  const layout = useRef<Array<{start:number;end:number;x:number;right:number;y:number;height:number;anchors:{ms:number;x:number}[];bands:{y:number;height:number}[]}>>([]);
  const playback = useRef(props);
  playback.current = props;
  const updateCursor = () => {
    const line = cursor.current, container = host.current;
    if (!line || !container) return;
    const p = playback.current;
    const bar = layout.current.find(b => p.currentMs < b.end) ?? layout.current.at(-1);
    if (!bar || !p.showCursor) { line.style.display = 'none'; return; }
    const fraction = Math.max(0, Math.min(1, (p.currentMs - bar.start) / Math.max(1, bar.end - bar.start)));
    const before = bar.anchors.filter(a => a.ms <= p.currentMs).at(-1);
    const after = bar.anchors.find(a => a.ms > p.currentMs);
    const x = before && after
      ? before.x + (after.x-before.x) * Math.max(0, (p.currentMs-before.ms)/(after.ms-before.ms))
      : before?.x ?? bar.x + fraction * (bar.right - bar.x);
    line.replaceChildren(...bar.bands.map(b => { const segment=document.createElement('div'); Object.assign(segment.style,{position:'absolute',top:`${b.y-bar.y}px`,height:`${b.height}px`,width:'2px',background:'#f59e0b'}); return segment; }));
    Object.assign(line.style, {display:'block',left:`${x}px`,top:`${bar.y}px`,height:`${bar.height}px`});
    if (p.autoFollow) {
      if (bar.y < container.scrollTop || bar.y + Math.min(bar.height, container.clientHeight) > container.scrollTop + container.clientHeight) container.scrollTop = Math.max(0, bar.y - 20);
      if (x < container.scrollLeft || x > container.scrollLeft + container.clientWidth - 20) container.scrollLeft = Math.max(0, x - 40);
    }
  };
  useEffect(updateCursor, [props.currentMs, props.showCursor, props.autoFollow]);
  const selected = useRef(new Set<string>());
  const noteInput = useRef(props.onNoteInput);
  noteInput.current = props.onNoteInput;
  const onSelectionChange = useRef(props.onSelectionChange);
  onSelectionChange.current = props.onSelectionChange;
  const onSelect = useRef(props.onSelectMeasure);
  onSelect.current = props.onSelectMeasure;
  useEffect(() => {
    const el = host.current;
    if (!el) return;
    const { score, trackIndex } = props;

    const indices = staffGroupIndices(score, trackIndex);
    const tracks = indices.map(i => score.tracks[i]);
    const blocks = tracks.map(t => extractTrackEvents(t, score.initialTimeSignature, score.initialKeyFifths));
    let cleanupSelection = () => {};
    const render = () => {
      cleanupSelection();
      el.replaceChildren();
      const scale = Math.max(.1, props.zoom ?? 1);
      const width = props.pages ? 1040 : Math.max(420, el.clientWidth / scale);
      const barWidth = Math.max(300, (width - 32) / Math.max(1, Math.floor((width - 32) / 300)));
      const perRow = Math.max(1, Math.floor((width - 32) / barWidth + .001));
      const rowHeight = tracks.length * 160 + 42;
      const totalCount = Math.max(...blocks.map(b => b.length));
      // Fold only identical complete passes shared by all staves of this instrument.
      const groups = repeatGroups(tracks[0]).filter(group => tracks.every(track =>
        repeatGroups(track).some(g => g.start === group.start && g.length === group.length && g.count === group.count)));
      const sourceFor = (index: number) => {
        const group = groups.find(g => index >= g.start && index < g.start + g.length * g.count);
        return group ? group.start + (index - group.start) % group.length : index;
      };
      const visible = Array.from({length: totalCount}, (_, i) => i).filter(i => sourceFor(i) === i);
      const count = visible.length;
      const rowsPerPage = Math.max(1, Math.floor(1120 / rowHeight));
      const pageHeight = rowsPerPage * rowHeight + 175;
      const rows = Math.ceil(count / perRow);
      const pageCount = Math.ceil(rows / rowsPerPage);
      const totalHeight = props.pages ? pageCount * (pageHeight + 36) : rows * rowHeight;
      const renderer = new Renderer(el, Renderer.Backends.SVG);
      renderer.resize(width * scale, totalHeight * scale);
      const ctx = renderer.getContext();
      ctx.scale(scale, scale);
      ctx.setFillStyle('currentColor'); ctx.setStrokeStyle('currentColor');
      if (props.pages) {
        for (let p = 0; p < pageCount; p++) {
          const top = p * (pageHeight + 36);
          ctx.setFillStyle('#fffdf7'); ctx.fillRect(0, top, width, pageHeight);
          ctx.setFillStyle('#24221f'); ctx.setFont('Arial', 13);
          const titleSize=Math.min(20,Math.max(12,860/Math.max(1,score.title.length)));
          ctx.setFont('Arial',titleSize);
          ctx.fillText(score.title, Math.max(32,(width-ctx.measureText(score.title).width)/2), top+32);
          ctx.setFont('Arial', 11);
          const composer=score.composer?.trim() || 'LMM';
          ctx.fillText(composer, width-32-ctx.measureText(composer).width, top+53);
          ctx.fillText(tracks[0]?.displayName ?? '', 20, top+56);
          ctx.fillText(`${score.initialTempo} BPM · ${score.initialTimeSignature.join('/')}`, 20, top+78);
          ctx.fillText(`${p+1} / ${pageCount}`,width-60,top+pageHeight-20);
        }
        ctx.setFillStyle('#24221f'); ctx.setStrokeStyle('#24221f');
      }
      const placed = new Map<string, Array<PlacedNote & {descriptor: VexEventDescriptor}>>();
      const hits: ScoreHit[] = [];
      const timings = tracks[0] ? [...walkMeasures(playbackTrack(tracks[0],score), score)] : [];
      layout.current = [];
      const geometry = new Map<number, (typeof layout.current)[number]>();
      for (let m = 0; m < count; m++) {
        const sourceIndex = visible[m];
        const group = groups.find(g => sourceIndex >= g.start && sourceIndex < g.start + g.length);
        const x = 16 + (m % perRow) * barWidth;
        const row = Math.floor(m / perRow);
        const y = props.pages ? Math.floor(row / rowsPerPage) * (pageHeight + 36) + (row % rowsPerPage) * rowHeight + 100 : row * rowHeight + 20;
        const entries = blocks.map((staff, i) => {
          const block = staff[sourceIndex];
          if (!block) return null;
          const stave = new Stave(x, y + i * 160, barWidth);
          if(m===0 && (!props.pages || i>0)) {ctx.setFont('Arial',11);ctx.fillText(tracks[i].displayName,x+4,y+i*160-3);}
          hits.push({ id: `m:${indices[i]}:${sourceIndex}`, kind: 'measure', x: x * scale, y: stave.getYForLine(0) * scale, width: barWidth * scale, height: (stave.getYForLine(4)-stave.getYForLine(0)) * scale, highlightRegions: [
            {x: x * scale, width: barWidth * scale, y: stave.getYForLine(0) * scale, height: (stave.getYForLine(4) - stave.getYForLine(0)) * scale},
          ], track: indices[i], measure: sourceIndex });
          applyStaveHeader(stave, staveHeader(block, { opening: m === 0, rowStart: m % perRow === 0 }));
          if (group && sourceIndex === group.start) stave.setBegBarType(BarlineType.REPEAT_BEGIN);
          if (group && sourceIndex === group.start + group.length - 1) stave.setEndBarType(BarlineType.REPEAT_END);
          else if (hasFinalBarline(tracks[i].measures, sourceIndex)) stave.setEndBarType(BarlineType.END);
          else if (tracks[i].measures[sourceIndex].endBarline === 'double') stave.setEndBarType(BarlineType.DOUBLE);
          const built = buildMeasure([block.events, block.voice2Events], block.timeSignature, block.clef);
          return { stave, built, block, track: indices[i] };
        }).filter(e => e !== null);
        const noteX = Math.max(...entries.map(e => e.stave.getNoteStartX()));
        const timing = timings[sourceIndex]?.state;
        if (timing) layout.current.push({anchors:[],start:timing.cumulativeMs,end:timing.cumulativeMs + qnToMs(measureLengthInQN(timing.timeSignature), timing.tempo),x:noteX * scale,right:(x + barWidth - 8) * scale,y:entries[0].stave.getYForLine(0)*scale,height:(entries.at(-1)!.stave.getYForLine(4)-entries[0].stave.getYForLine(0))*scale,bands:entries.map(e=>({y:e.stave.getYForLine(0)*scale,height:(e.stave.getYForLine(4)-e.stave.getYForLine(0))*scale}))});
        const formatter = new Formatter();
        for (const { stave, built } of entries) {
          stave.setNoteStartX(noteX).setContext(ctx).draw();
          for (const modifier of stave.getModifiers()) {
            if (modifier instanceof Barline && [BarlineType.REPEAT_BEGIN, BarlineType.REPEAT_END].includes(modifier.getType())) {
              modifier.getSVGElement()?.setAttribute('data-score-repeat-sign', '');
            }
          }
          if (built) {
            built.notes.flat().forEach(n => { n.setStave(stave); n.setStyle({ fillStyle: props.pages ? '#24221f' : 'currentColor', strokeStyle: props.pages ? '#24221f' : 'currentColor' }); });
            formatter.joinVoices(built.voices);
          }
        }
        const voices = entries.flatMap(e => e.built?.voices ?? []);
        if (voices.length) formatter.format(voices, Math.max(80, x + barWidth - noteX - 20));
        entries.forEach(({ stave, built, track, block }) => {
          if (!built) return;
          drawMeasure(ctx, stave, built);
          // Follow engraved note spacing, which is not proportional to time.
          // The transport and metronome still use the same musical timestamps.
          if (track === indices[0] && timing) {
            const bar = layout.current.at(-1)!;
            let qn = 0;
            bar.anchors = (built.notes[0] ?? []).map((note, event) => {
              const anchor = {ms: timing.cumulativeMs + qnToMs(qn, timing.tempo), x: note.getAbsoluteX() * scale};
              qn += block.events[event]?.durationQN ?? 0;
              return anchor;
            });
            bar.anchors.push({ms: bar.end, x: bar.right});
          }
          built.notes.forEach((notes, voice) => notes.forEach((note, event) => {
            const descriptor = (voice === 0 ? block.events : block.voice2Events ?? [])[event];
            if (descriptor) {
              const key = `${track}:${voice}`;
              const lane = placed.get(key) ?? [];
              lane.push({ id:descriptor.id,note,system:row,hasDynamic:!!descriptor.dynamic,descriptor });
              placed.set(key,lane);
            }
            const usedMembers = new Set<number>();
            note.noteHeads.forEach((head) => {
              // VexFlow orders heads by stem direction, independently of XML pitch order.
              const member = note.getKeyProps().findIndex((key, i) => key.line === head.getLine() && !usedMembers.has(i));
              if (member < 0) return;
              usedMembers.add(member);
              hits.push({ id: `n:${track}:${sourceIndex}:${voice}:${event}:${member}`, kind: 'note', track, measure: sourceIndex, voice, event, member,
                x: (head.getAbsoluteX() - 2) * scale, y: (head.getY() - 5) * scale, width: 16 * scale, height: 10 * scale });
            });
          }));
        });
        if (entries.length > 1) {
          new StaveConnector(entries[0].stave, entries.at(-1)!.stave).setType('singleLeft').setContext(ctx).draw();
          new StaveConnector(entries[0].stave, entries.at(-1)!.stave).setType('singleRight').setContext(ctx).draw();
          if (m % perRow === 0) new StaveConnector(entries[0].stave, entries.at(-1)!.stave).setType('brace').setContext(ctx).draw();
        }
        ctx.setFont('Arial', 11); ctx.fillText(String(m + 1), x + 4, y + 12);
        if (group && sourceIndex === group.start + group.length - 1 && group.count > 2) {
          ctx.setFont('Arial', 12, 'italic');
          const label = `${group.count} times`;
          ctx.fillText(label, x + barWidth - ctx.measureText(label).width - 8, y + 20);
        }
        if (timing) geometry.set(sourceIndex, layout.current.at(-1)!);

      }

      // Keep the full performance clock; later passes return to the same engraving.
      layout.current = timings.flatMap(({state}, index) => {
        const original = geometry.get(sourceFor(index));
        if (!original) return [];
        const end = state.cumulativeMs + qnToMs(measureLengthInQN(state.timeSignature), state.tempo);
        const ratio = (end-state.cumulativeMs)/(original.end-original.start);
        return [{...original, start: state.cumulativeMs, end,
          anchors: original.anchors.map(a => ({x:a.x, ms:state.cumulativeMs+(a.ms-original.start)*ratio}))}];
      });
      placed.forEach(lane => {
        drawSpanSegments(ctx, spanSegments(score.spans, lane));
        for (let i = 0; i + 1 < lane.length; i++) {
          const a = lane[i], b = lane[i + 1];
          const indices = scoreTieIndices(a.descriptor,b.descriptor);
          if (!indices.firstIndexes.length) continue;
          if (a.system === b.system) new StaveTie({firstNote:a.note,lastNote:b.note,...indices}).setContext(ctx).draw();
          else {
            new StaveTie({firstNote:a.note,...indices}).setContext(ctx).draw();
            new StaveTie({lastNote:b.note,...indices}).setContext(ctx).draw();
          }
        }
      });
      // HTML hit areas share the SVG scale and scroll surface. Keyboard users
      // can select a measure with Enter or Space. Native pinch zoom is untouched.
      if (onSelect.current) {
        const surface = document.createElement('div');
        surface.style.position = 'relative';
        surface.style.width = `${width * scale}px`;
        const svg = el.querySelector('svg')!;
        el.appendChild(surface); surface.appendChild(svg);
        cleanupSelection = installScoreSelection(surface, hits, selected.current, selection => {
          onSelectionChange.current?.(selection);
          if (!onSelectionChange.current && selection.length === 1 && selection[0].kind === 'measure') onSelect.current?.(selection[0].track, selection[0].measure);
        }, {measureHeaderHeight: 0, onInput: (hit,line) => noteInput.current?.(hit,line) ?? false});
      }
      const surface = el.querySelector('svg')?.parentElement;
      if (surface) {
        surface.style.position = 'relative';
        const line = document.createElement('div');
        line.dataset.testid = 'score-playback-cursor';
        Object.assign(line.style, {position:'absolute',width:'2px',pointerEvents:'none',zIndex:'5'});
        surface.appendChild(line); cursor.current = line;
        updateCursor();
      }
    };
    render();
    const observer = new ResizeObserver(render); observer.observe(el);
    return () => { observer.disconnect(); cleanupSelection(); el.replaceChildren(); };
  }, [props.score, props.trackIndex, props.zoom, props.pages, !!props.onSelectMeasure]);
  return <div ref={host} role="region" aria-label="Instrument staves" className={`min-h-0 overflow-auto ${props.className ?? ''}`} style={{ height: '100%', overscrollBehaviorX: 'none' }} />;
}
