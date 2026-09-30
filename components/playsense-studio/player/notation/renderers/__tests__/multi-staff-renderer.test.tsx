// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, it, vi } from 'vitest';
import { parseMusicXmlBuffer } from '@/lib/playsense-studio/parsers/musicxml';
import { MultiStaffRenderer } from '../multi-staff-renderer';

it('engraves all 25 pairs of staves from the supplied piano score', async () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
  const bytes = readFileSync(resolve(process.cwd(), 'lib/playsense-studio/__tests__/fixtures/multi-staff.mxl'));
  const score = await parseMusicXmlBuffer(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 'score.mxl');
  const host = document.createElement('div'); document.body.appendChild(host);
  const root = createRoot(host);
  try {
    act(() => root.render(<MultiStaffRenderer score={score} trackIndex={0} currentMs={0} />));
    expect(host.querySelectorAll('.vf-stave')).toHaveLength(50);
    expect(host.querySelectorAll('.vf-stavenote')).toHaveLength(238);
    expect(host.textContent).toContain('25');
    const original = JSON.stringify(score);
    const selected=vi.fn();
    const pointer=(target:Element,type:string,x:number,y:number)=>{
      const event=new MouseEvent(type,{bubbles:true,button:0,clientX:x,clientY:y});
      Object.defineProperty(event,'pointerId',{value:1});
      act(()=>target.dispatchEvent(event));
    };
    for(const scale of [1,.5]) {
      act(()=>root.render(<MultiStaffRenderer score={score} trackIndex={0} currentMs={0} showCursor pages zoom={scale} onSelectMeasure={()=>{}} onSelectionChange={selected}/>));
      const bar=host.querySelector<HTMLElement>('[data-score-selection="m:0:0"]')!;
      const surface=bar.parentElement!;
      const regions=[...host.querySelectorAll<HTMLElement>('[data-score-highlight="m:0:0"]')];
      expect(regions).toHaveLength(1);
      expect(parseFloat(bar.style.height)).toBeCloseTo(40*scale);
      expect(bar.style.top).toBe(regions[0].style.top);
      const cursor=host.querySelector<HTMLElement>('[data-testid=score-playback-cursor]')!;
      expect(cursor.children).toHaveLength(2);
      for(const segment of cursor.children) expect(parseFloat((segment as HTMLElement).style.height)).toBeCloseTo(40*scale);
      expect(parseFloat(regions[0].style.height)).toBeCloseTo(40*scale);
      const x=parseFloat(bar.style.left)+5*scale;
      const top=parseFloat(regions[0].style.top);
      pointer(bar,'pointerdown',x,top+20*scale);pointer(surface,'pointerup',x,top+20*scale);
      expect(selected.mock.lastCall?.[0][0].kind).toBe('measure');
      expect(bar.style.background).toBe('transparent');
      expect(regions[0].style.display).toBe('block');
      const gap=parseFloat(bar.style.top)-10*scale;
      pointer(bar,'pointerdown',x,gap);pointer(surface,'pointerup',x,gap);
      expect(selected.mock.lastCall?.[0]).toEqual([]);
      expect(regions[0].style.display).toBe('none');
      pointer(bar,'pointerdown',x,top+65*scale);pointer(surface,'pointerup',x,top+65*scale);
      expect(selected.mock.lastCall?.[0]).toEqual([]);
    }
    act(() => root.render(<MultiStaffRenderer score={score} trackIndex={0} currentMs={0} pages zoom={1} onSelectMeasure={() => {}} />));
    const fullX = parseFloat(host.querySelector<HTMLElement>('[data-score-selection^="n:"]')!.style.left);
    act(() => root.render(<MultiStaffRenderer score={score} trackIndex={0} currentMs={0} pages zoom={.1} onSelectMeasure={() => {}} />));
    expect(host.querySelectorAll('.vf-stave')).toHaveLength(50);
    expect(parseFloat(host.querySelector<HTMLElement>('[data-score-selection^="n:"]')!.style.left)).toBeCloseTo(fullX / 10);
    expect(JSON.stringify(score)).toBe(original);
  } finally {
    act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals();
  }
});

it('folds repeated passes into musical repeat signs while the full clock follows engraved notes',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 vi.stubGlobal('ResizeObserver',class {observe(){}disconnect(){}});
 const ctx={measureText:(s:string)=>({width:String(s).length*6,actualBoundingBoxAscent:8,actualBoundingBoxDescent:2,fontBoundingBoxAscent:8,fontBoundingBoxDescent:2}),font:''};
 vi.spyOn(HTMLCanvasElement.prototype,'getContext').mockImplementation((()=>ctx) as never);
 const score={schemaVersion:1,title:'Repeats',sourceFormat:'native',initialTempo:120,initialTimeSignature:[4,4],initialKeyFifths:0,
  tracks:[{index:0,instrument:'staff',displayName:'Test',tuning:null,stringMultiplicity:1,channel:null,defaultView:'staff',
   measures:Array.from({length:21},(_,i)=>({number:i+1,
    ...(i<20?{repeat:{id:'r',pass:Math.floor(i/2),offset:i%2,count:10,length:2}}:{}),
    voices:[{number:1,events:[1,.5,.5,2].map(durationQN=>({kind:'note',midi:60,durationQN}))}],
   }))}]} as import('@/components/playsense-studio/shared/score-model/types').ScoreDocument;
 const original=JSON.stringify(score);
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 try {
  const render=(currentMs:number)=>act(()=>root.render(<MultiStaffRenderer score={score} trackIndex={0} currentMs={currentMs} pages showCursor onSelectMeasure={()=>{}}/>));
  render(0);
  expect(host.querySelectorAll('.vf-stave')).toHaveLength(3);
  expect(host.querySelectorAll('[data-score-repeat-sign]')).toHaveLength(2);
  expect(host.textContent).toContain('10 times');
  expect(host.textContent).not.toContain('pass ');
  const cursor=()=>parseFloat(host.querySelector<HTMLElement>('[data-testid=score-playback-cursor]')!.style.left);
  const note=(event:number)=>parseFloat(host.querySelector<HTMLElement>(`[data-score-selection="n:0:0:0:${event}:0"]`)!.style.left)+2;
  expect(cursor()).toBeCloseTo(note(0));
  render(500);expect(cursor()).toBeCloseTo(note(1));
  render(750);expect(cursor()).toBeCloseTo(note(2));
  render(4000);expect(cursor()).toBeCloseTo(note(0));
  render(4500);expect(cursor()).toBeCloseTo(note(1));
  render(40000);
  expect(cursor()).toBeCloseTo(parseFloat(host.querySelector<HTMLElement>('[data-score-selection="n:0:20:0:0:0"]')!.style.left)+2);
  expect(JSON.stringify(score)).toBe(original);
 } finally {act(()=>root.unmount());host.remove();vi.restoreAllMocks();vi.unstubAllGlobals();}
});
