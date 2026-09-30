// @vitest-environment jsdom
import React, { act, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { editorReducer, type EditorState } from '@/lib/playsense-studio/editor-state';

const extractSpy = vi.hoisted(() => ({ calls: 0 }));
vi.mock('@/lib/playsense-studio/score-to-vexflow', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/playsense-studio/score-to-vexflow')>();
  return {
    ...actual,
    extractTrackEvents: (...args: Parameters<typeof actual.extractTrackEvents>) => {
      extractSpy.calls++;
      return actual.extractTrackEvents(...args);
    },
  };
});

import { IntegratedEditor, type IntegratedEditorMeasureTiming } from '../integrated-editor';

beforeAll(() => {
  // VexFlow measures text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' };
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
});

const score: ScoreDocument = {
  schemaVersion: 1, title: 'T', sourceFormat: 'native', initialTempo: 120,
  initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tracks: [{
    index: 0, instrument: 'staff', displayName: 'T', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
    measures: [1, 2].map(number => ({ number, voices: [{ number: 1, events: [{ kind: 'note' as const, midi: 60, durationQN: 4 }] }] })),
  }],
} as ScoreDocument;

const timings = (shift: number): IntegratedEditorMeasureTiming[] => [
  { measureNumber: 1, startVideoTimeSeconds: shift, endVideoTimeSeconds: shift + 2 },
  { measureNumber: 2, startVideoTimeSeconds: shift + 2, endVideoTimeSeconds: shift + 4 },
];

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  localStorage.clear();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const noop = () => {};
function render(measureTimings: IntegratedEditorMeasureTiming[]) {
  act(() => {
    root.render(
      <IntegratedEditor
        score={score} dispatch={noop} measureTimings={measureTimings} pixelsPerSecond={100} scrollLeftPx={0}
        viewportWidth={800} onRequestZoom={noop}
      />,
    );
  });
}

describe('IntegratedEditor strip items', () => {
  it('uses horizontal strips for every staff when synchronization explicitly disables pages', () => {
    const grouped: ScoreDocument = { ...score, tracks: [0, 1].map(index => ({
      ...score.tracks[0], index, staffGroup: 'piano', staffNumber: index + 1,
      measures: score.tracks[0].measures.map(m => ({ ...m, clef: index ? 'bass' as const : 'treble' as const })),
    })) };
    const before = JSON.stringify(grouped);
    act(() => root.render(<IntegratedEditor pageWorkspace={false} score={grouped} dispatch={noop} measureTimings={timings(0)} pixelsPerSecond={100} scrollLeftPx={0} viewportWidth={800} onRequestZoom={noop} />));
    expect(host.querySelectorAll('[data-timeline-staff]')).toHaveLength(2);
    expect(host.querySelector('[data-testid="linear-score"]')).not.toBeNull();
    expect(JSON.stringify(grouped)).toBe(before);
  });

  it('selects the lower staff without automatic zoom and edits only on explicit request', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    const grouped: ScoreDocument = { ...score, tracks: [0, 1].map(index => ({
      ...score.tracks[0], index, staffGroup: 'piano', staffNumber: index + 1,
      measures: score.tracks[0].measures.map(m => ({ ...m, clef: index ? 'bass' as const : 'treble' as const })),
    })) };
    const dispatch = vi.fn();
    try {
      act(() => root.render(<IntegratedEditor score={grouped} dispatch={dispatch} measureTimings={timings(0)} pixelsPerSecond={100} scrollLeftPx={0} viewportWidth={800} onRequestZoom={noop} />));
      expect(host.querySelector('[data-measure-index]')).toBeNull();
      const note = host.querySelector<HTMLButtonElement>('[aria-label="Select staff 2, measure 1, voice 1, note 1, pitch 1"]')!;
      act(() => note.click());
      expect(host.querySelector('[data-testid="measure-zoom"]')).toBeNull();
      const deleteNote = Array.from(host.querySelectorAll('button')).find(b => b.textContent === 'Delete notes')!;
      act(() => deleteNote.click());
      expect(dispatch).toHaveBeenLastCalledWith({type:'delete-selected-pitches',refs:[{trackIndex:1,measureIndex:0,voice:0,eventIndex:0,member:0}]});
      dispatch.mockClear();
      const lower = host.querySelector<HTMLButtonElement>('[aria-label="Select staff 2, measure 1"]')!;
      expect(lower).not.toBeNull();
      act(() => lower.click());
      expect(host.querySelector('[data-testid="measure-zoom"]')).toBeNull();
      expect(dispatch).not.toHaveBeenCalled();
      act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })));
      expect(host.querySelector('[data-testid="measure-zoom"]')).not.toBeNull();
      const half = host.querySelector<HTMLButtonElement>('.st-zoom-dock [aria-label="Half"]')!;
      act(() => half.click());
      act(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true, cancelable: true })));
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'transpose-events', refs: [expect.objectContaining({ trackIndex: 1, measureIndex: 0 })] }));
    } finally { vi.unstubAllGlobals(); }
  });

  it('applies a palette symbol in Sync using the selected lower staff without starting a separate player', () => {
    vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
    localStorage.clear();
    const grouped: ScoreDocument = {...score, tracks:[0,1].map(index=>({...score.tracks[0],index,staffGroup:'piano',staffNumber:index+1}))};
    const dispatch=vi.fn();
    try {
      act(()=>root.render(<IntegratedEditor pageWorkspace={false} score={grouped} dispatch={dispatch} measureTimings={timings(0)} pixelsPerSecond={100} scrollLeftPx={0} viewportWidth={800} onRequestZoom={noop}/>));
      expect(host.querySelector('.lmm-palette-chooser')).toBeNull();
      act(()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Show palettes')!.click());
      expect(host.querySelector('.lmm-palette-chooser')).not.toBeNull();
      expect(host.querySelector('[aria-label="Score playback"]')).toBeNull();
      const note=host.querySelector<HTMLButtonElement>('[aria-label="Select staff 2, measure 1, voice 1, note 1, pitch 1"]')!;
      expect(note).not.toBeNull();act(()=>note.click());
      const symbol=host.querySelector<HTMLButtonElement>('[aria-label="dynamic MF"]')!;
      expect(symbol).not.toBeNull();act(()=>symbol.click());
      const apply=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Apply to selection')!;
      expect(apply.disabled).toBe(false);act(()=>apply.click());
      expect(dispatch).toHaveBeenCalledWith({type:'apply-palette-actions',actions:[{type:'set-events-dynamic',refs:[{trackIndex:1,measureIndex:0,voice:0,eventIndex:0}],dynamic:'mf'}]});
      expect(host.querySelectorAll('[data-timeline-staff]')).toHaveLength(2);
    } finally {vi.unstubAllGlobals();}
  });

  it.each([false,true])('starts writing a quarter into a selected empty measure, pages=%s', pageWorkspace=>{
    const empty={...score,tracks:[{...score.tracks[0],measures:[{number:1,voices:[{number:1,events:[]}]}]}]};
    const dispatch=vi.fn();
    act(()=>root.render(<IntegratedEditor pageWorkspace={pageWorkspace} score={empty} dispatch={dispatch} measureTimings={timings(0).slice(0,1)} pixelsPerSecond={100} scrollLeftPx={0} viewportWidth={800} onRequestZoom={noop}/>));
    const bar=host.querySelector<HTMLButtonElement>('[aria-label="Select staff 1, measure 1"]')!;
    expect(bar).not.toBeNull();
    act(()=>bar.click());
    const notes=host.querySelector('[data-palette="common:Notes"]')!;
    act(()=>notes.querySelector<HTMLButtonElement>('[aria-label="note Quarter Up"]')!.click());
    const write=Array.from(notes.querySelectorAll('button')).find(b=>b.textContent==='Write in measure')!;
    expect(write.disabled).toBe(false);
    act(()=>write.click());
    expect(host.querySelector('[data-testid="measure-zoom"]')).not.toBeNull();
    expect(host.querySelector('[aria-label="Pencil"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(host.querySelector('.st-zoom-dock [aria-label="Quarter"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(dispatch).not.toHaveBeenCalled(); // choosing a tool never writes a note
  });

  it.each([false,true])('writes in the normal score and switches views without losing the edit, pages=%s', pageWorkspace=>{
    const empty={...score,tracks:[{...score.tracks[0],measures:[{number:1,voices:[{number:1,events:[]}]}]}]};
    let current:ScoreDocument=empty;
    const requestZoom=vi.fn();
    function Harness() {
      const [state,dispatch]=useReducer(editorReducer,empty,(score):EditorState=>({score,past:[],future:[],isDirty:false}));
      current=state.score;
      return <IntegratedEditor pageWorkspace={pageWorkspace} score={state.score} dispatch={dispatch} measureTimings={timings(0).slice(0,1)} pixelsPerSecond={100} scrollLeftPx={0} viewportWidth={800} onRequestZoom={requestZoom}/>;
    }
    act(()=>root.render(<Harness/>));
    const click=(text:string)=>act(()=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent===text)!.click());
    click('Normal');
    expect(localStorage.getItem('lmm-note-edit-view')).toBe('normal');
    act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Select staff 1, measure 1"]')!.click());
    const notes=host.querySelector('[data-palette="common:Notes"]')!;
    act(()=>notes.querySelector<HTMLButtonElement>('[aria-label="note Quarter Up"]')!.click());
    click('Write in measure');
    expect(host.querySelector('[data-testid="measure-zoom"]')).toBeNull();
    expect(host.querySelector('[data-testid="normal-note-editor"]')).not.toBeNull();
    const entry=()=>host.querySelector('[data-testid="normal-note-editor"]')!;
    act(()=>entry().querySelector<HTMLButtonElement>('[aria-label="Rest"]')!.click());
    expect(entry().querySelectorAll('[data-entry-kind="rest"]')).toHaveLength(7);
    expect(entry().querySelectorAll('[data-entry-kind="note"]')).toHaveLength(0);
    expect(current.tracks[0].measures[0].voices[0].events).toHaveLength(0);
    act(()=>entry().querySelector<HTMLButtonElement>('[aria-label="Quarter rest"]')!.click());
    expect(entry().querySelectorAll('[data-entry-kind="rest"]')).toHaveLength(7);
    act(()=>entry().querySelector<HTMLButtonElement>('[aria-label="Notes"]')!.click());
    expect(entry().querySelectorAll('[data-entry-kind="note"]')).toHaveLength(7);
    const bar=host.querySelector<HTMLButtonElement>('[aria-label="Select staff 1, measure 1"]')!;
    const regions=host.querySelectorAll<HTMLElement>(`[data-score-highlight="${bar.dataset.scoreSelection}"]`);
    const band=regions[regions.length-1];
    const x=parseFloat(band.style.left)+parseFloat(band.style.width)*.8;
    const y=parseFloat(band.style.top)+parseFloat(band.style.height)*.5;
    act(()=>bar.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0,clientX:x,clientY:y})));
    expect(current.tracks[0].measures[0].voices[0].events).toHaveLength(1);
    for(let i=0;i<3;i++) act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'0',bubbles:true})));
    const events=current.tracks[0].measures[0].voices[0].events;
    expect(events.map(e=>e.kind)).toEqual(['note','rest','rest','rest']);
    click('Expanded');
    expect(host.querySelector('[data-testid="measure-zoom"]')).not.toBeNull();
    const normal=Array.from(host.querySelectorAll<HTMLButtonElement>('[data-testid="measure-zoom"] button')).find(b=>b.textContent==='Normal')!;
    act(()=>normal.click());
    expect(host.querySelector('[data-testid="measure-zoom"]')).toBeNull();
    expect(current.tracks[0].measures[0].voices[0].events).toEqual(events);
    expect(requestZoom).not.toHaveBeenCalled();
    act(()=>window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
    expect(host.querySelector('[data-testid="normal-note-editor"]')).toBeNull();
  });

  it.each(['note','measure'])('applies Utilities noteheads to the selected %s', async kind=>{
    const dispatch=vi.fn();
    act(()=>root.render(<IntegratedEditor score={score} dispatch={dispatch} measureTimings={timings(0)} pixelsPerSecond={100} scrollLeftPx={0} viewportWidth={800} onRequestZoom={noop}/>));
    const label=kind==='note'?'Select staff 1, measure 1, voice 1, note 1, pitch 1':'Select staff 1, measure 1';
    act(()=>host.querySelector<HTMLButtonElement>(`[aria-label="${label}"]`)!.click());
    const utilities=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Utilities')!;
    await act(async()=>utilities.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
    for(const text of ['Noteheads','Other noteheads']) {
      const item=Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(e=>e.textContent===text)!;
      await act(async()=>item.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
    }
    const plus=Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(e=>e.textContent?.endsWith('Plus'))!;
    await act(async()=>plus.click());
    expect(dispatch).toHaveBeenLastCalledWith({type:'set-noteheads',notehead:'plus',refs:[{trackIndex:0,measureIndex:0,voice:0,eventIndex:0,...(kind==='note'?{member:0}:{})}]});
  });

  it('offers the original 16 timbal strokes and applies cascara to the selected note',async()=>{
    const timbal={...score,tracks:score.tracks.map(t=>({...t,instrument:'perc-timbal' as const}))};
    const dispatch=vi.fn();
    act(()=>root.render(<IntegratedEditor score={timbal} dispatch={dispatch} measureTimings={timings(0)} pixelsPerSecond={100} scrollLeftPx={0} viewportWidth={800} onRequestZoom={noop}/>));
    act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Select staff 1, measure 1, voice 1, note 1, pitch 1"]')!.click());
    const utilities=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Utilities')!;
    await act(async()=>utilities.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})));
    const trigger=Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(e=>e.textContent==='Noteheads')!;
    await act(async()=>trigger.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true})));
    const menu=document.querySelector<HTMLElement>('[data-slot="dropdown-menu-sub-content"]')!;
    expect(menu.textContent).toContain('Instrument legend · Timbales');
    // Sixteen original strokes, the Others submenu and restore.
    expect(menu.querySelectorAll('[role="menuitem"]')).toHaveLength(18);
    expect(menu.textContent).toContain('Low cross-stick');
    expect(menu.textContent).toContain('Elbow strike');
    const cascara=Array.from(menu.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(e=>e.textContent?.includes('Cáscara · high'))!;
    await act(async()=>cascara.click());
    expect(dispatch).toHaveBeenLastCalledWith({type:'set-legend-stroke',strokeId:'cascara',refs:[{trackIndex:0,measureIndex:0,voice:0,eventIndex:0,member:0}]});
  });

  it('does not re-extract the track when only the sync markers move', () => {
    render(timings(0));
    const afterMount = extractSpy.calls;
    expect(afterMount).toBeGreaterThan(0);
    render(timings(0.5));
    render(timings(1));
    expect(extractSpy.calls).toBe(afterMount);
  });

  it('has no editor row: the tools sit in the strip corner', () => {
    render(timings(0));
    expect(host.querySelector('input[aria-label="Track name"]')).toBeNull();
    const corner = host.querySelector('.st-strip-corner')!;
    expect(corner).not.toBeNull();
    expect(corner.querySelector('[aria-label="Staff"]')).not.toBeNull();
    expect(corner.querySelector('[aria-label="Piano-roll"]')).not.toBeNull();
    expect(corner.querySelector('[aria-label="Record MIDI"]')).not.toBeNull();
    expect(corner.querySelector('[aria-label="Add a measure at the end"]')).not.toBeNull();
  });

  // Review Focus 4: the docked toolbar's buttons keep focus where it was
  // (onMouseDown preventDefault), so the zoom's window key handler still
  // gets the digits after a click.
  it('keeps the zoom keys working after a docked toolbar button is clicked', () => {
    function Harness() {
      const [state, dispatch] = useReducer(editorReducer, score, (s): EditorState => ({ score: s, past: [], future: [], isDirty: false }));
      return (
        <IntegratedEditor
          score={state.score} dispatch={dispatch} measureTimings={timings(0)} pixelsPerSecond={100} scrollLeftPx={0}
          viewportWidth={800} onRequestZoom={noop}
        />
      );
    }
    act(() => { root.render(<Harness />); });
    const key = (k: string) => act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
    });
    key('ArrowRight'); // select bar 0
    key('Enter'); // open the zoom on it, its note selected
    const dock = () => host.querySelector('.st-zoom-dock')!;
    const quarter = dock().querySelector<HTMLButtonElement>('[aria-label="Quarter"]')!;
    const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    act(() => { quarter.dispatchEvent(down); quarter.click(); });
    expect(down.defaultPrevented).toBe(true);
    expect(dock().querySelector('[aria-label="Quarter"]')!.getAttribute('aria-pressed')).toBe('true');
    key('6'); // KEY_VALUE: 6 is Half
    expect(dock().querySelector('[aria-label="Half"]')!.getAttribute('aria-pressed')).toBe('true');
  });
});
