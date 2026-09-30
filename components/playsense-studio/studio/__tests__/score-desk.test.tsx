// @vitest-environment jsdom
import React, {act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
vi.stubGlobal('ResizeObserver', class { observe(){} disconnect(){} });
const language = vi.hoisted(() => ({ locale: 'en' as 'en' | 'es' }));
vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ locale: language.locale }) }));
import {ScoreDesk} from '../score-desk';
vi.mock('../../player/notation/renderers/multi-staff-renderer',()=>({MultiStaffRenderer:({zoom,onSelectionChange,currentMs}: {zoom:number;currentMs:number;onSelectionChange?:(hits:unknown[])=>void})=><div data-zoom={zoom} data-current-ms={currentMs}><button data-test-select onClick={()=>onSelectionChange?.([{id:'note-6',kind:'note',track:0,measure:5,voice:0,event:2,x:0,y:0,width:10,height:10}])}>Select test note</button></div> }));
it('consumes horizontal trackpad gestures in Sync and page views, including at an edge', () => {
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();
 const el=document.createElement('div');document.body.appendChild(el);const root=createRoot(el);
 const pan=vi.fn();
 const render=(linear:boolean)=>act(()=>root.render(<ScoreDesk linear={linear} onPan={pan} score={{} as never} trackIndex={0} currentMs={0} hasSelection={false} onApply={()=>{}} onEdit={()=>{}} onDelete={()=>{}}/>));
 try {
  render(true);
  let area=el.querySelector<HTMLElement>('[data-testid="score-pan-area"]')!;
  const gesture=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX:-80,deltaY:12});
  act(()=>area.dispatchEvent(gesture));
  expect(gesture.defaultPrevented).toBe(true);
  expect(pan).toHaveBeenCalledWith(-80);
  const vertical=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaY:60});
  act(()=>area.dispatchEvent(vertical));
  expect(vertical.defaultPrevented).toBe(false);
  render(false);
  area=el.querySelector<HTMLElement>('[data-testid="score-pan-area"]')!;
  const region=document.createElement('div');region.setAttribute('role','region');area.appendChild(region);
  const pagePan=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX:90});
  act(()=>region.dispatchEvent(pagePan));
  expect(pagePan.defaultPrevented).toBe(true);
  expect(region.scrollLeft).toBe(90);
  region.remove();
 }finally{act(()=>root.unmount());el.remove();}
});


it('keeps floating palettes visible when the menu closes and supports favorites in Sync',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();
 const el=document.createElement('div');document.body.appendChild(el);const root=createRoot(el);const apply=vi.fn();
 const clickText=(text:string)=>act(()=>Array.from(el.querySelectorAll('button')).find(b=>b.textContent===text)!.click());
 try{
 act(()=>root.render(<ScoreDesk linear score={{} as never} trackIndex={0} currentMs={0} hasSelection onApply={apply} onEdit={()=>{}} onDelete={()=>{}}/>));
 expect(el.querySelectorAll('[data-palette]').length).toBe(3);
 expect(el.querySelector('aside')).toBeNull();
 clickText('Show palettes');expect(el.querySelector('aside')).not.toBeNull();
 clickText('Hide palettes');expect(el.querySelector('aside')).toBeNull();
 clickText('Show palettes');
 act(()=>document.body.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})));
 expect(el.querySelector('aside')).toBeNull();
 clickText('Show palettes');
 act(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})));
 expect(el.querySelector('aside')).toBeNull();
 expect(el.querySelectorAll('[data-palette]').length).toBe(3);
 const main=el.querySelector('[data-palette="common:Main"]')!;
 act(()=>main.querySelector<HTMLButtonElement>('[data-command-status="ready"]')!.click());
 clickText('Apply to selection');expect(apply).toHaveBeenCalledWith('noteQuarterUp');
 act(()=>main.querySelector<HTMLButtonElement>('[aria-label="Toggle favorite"]')!.click());
 clickText('Show palettes');
 const favorite=Array.from(el.querySelectorAll('label')).find(l=>l.textContent==='Favorites')!.querySelector('input')!;
 act(()=>favorite.click());
 expect(el.querySelector('[data-palette="favorites"] [data-command-status="ready"]')).not.toBeNull();
 act(()=>el.querySelector<HTMLButtonElement>('[aria-label="× Rests"]')!.click());
 expect(el.querySelector('[data-palette="common:Rests"]')).toBeNull();
 expect(Array.from(el.querySelectorAll('label')).find(l=>l.textContent==='Rests')!.querySelector('input')!.checked).toBe(false);
 }finally{act(()=>root.unmount());el.remove();}
});

it('floats playback in page view and preserves categories through a language switch',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();
 const el=document.createElement('div');document.body.appendChild(el);const root=createRoot(el);
 const render=()=>root.render(<ScoreDesk score={{} as never} trackIndex={0} currentMs={0} hasSelection={false} onApply={()=>{}} onEdit={()=>{}} onDelete={()=>{}}/>);
 try{
 act(render);expect(el.querySelector('[data-palette="playback"] form')).not.toBeNull();
 expect(el.querySelector<HTMLElement>('[data-palette="playback"]')!.style.width).toBe('620px');
 const record=el.querySelector<HTMLButtonElement>('[aria-label="Record MIDI — coming soon"]')!;
 expect(record.disabled).toBe(true);
 expect(record.previousElementSibling?.getAttribute('aria-label')).toBe('Stop');
 expect(el.querySelector('.lmm-transport-strip [aria-label="Metronome"]')).toBeNull();
 expect(el.querySelector<HTMLFieldSetElement>('[data-palette="playback"] fieldset')!.disabled).toBe(true);

 expect(el.querySelector<HTMLElement>('[data-palette="common:Main"]')!.style.width).toBe('224px');
 const main=el.querySelector<HTMLElement>('[data-palette="common:Main"]')!;
 expect(main.className).toContain('absolute');
 act(()=>el.querySelector<HTMLButtonElement>('[aria-label="Zoom in score"]')!.click());
 expect(Number(el.querySelector('[data-zoom]')!.getAttribute('data-zoom'))).toBeGreaterThan(1);
 language.locale='es';act(render);expect(main.querySelector('h3')!.textContent).toBe('Principal');
 expect(el.querySelector('[data-palette="playback"] h3')!.textContent).toBe('Reproducción de la partitura');
 }finally{language.locale='en';act(()=>root.unmount());el.remove();}
});

it.each([true,false])('opens note entry from a measure selection in linear=%s', linear=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true}); localStorage.clear();
 const el=document.createElement('div');document.body.appendChild(el);const root=createRoot(el);const write=vi.fn();
 try {
  act(()=>root.render(<ScoreDesk linear={linear} score={{} as never} trackIndex={0} currentMs={0} hasSelection={false} hasMeasureSelection onApply={()=>{}} onWrite={write} onEdit={()=>{}} onDelete={()=>{}}/>));
  const notes=el.querySelector('[data-palette="common:Notes"]')!;
  act(()=>notes.querySelector<HTMLButtonElement>('[aria-label="note Quarter Up"]')!.click());
  const button=Array.from(notes.querySelectorAll('button')).find(b=>b.textContent==='Write in measure')!;
  expect(button.disabled).toBe(false);
  act(()=>button.click());
  expect(write).toHaveBeenCalledWith('noteQuarterUp');
 } finally {act(()=>root.unmount());el.remove();}
});


it('updates the floating playback clock to the selected note in measure six',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);const selection=vi.fn();
 const score={initialTempo:120,initialTimeSignature:[4,4],tracks:[{measures:Array.from({length:6},(_,i)=>({number:i+1,voices:[{events:[{kind:'note',midi:60,durationQN:1},{kind:'rest',durationQN:.5},{kind:'note',midi:60,durationQN:.5}]}]}))}]} as never;
 try{
  act(()=>root.render(<ScoreDesk score={score} trackIndex={0} currentMs={0} hasSelection={false} onApply={()=>{}} onEdit={()=>{}} onDelete={()=>{}} onSelectionChange={selection}/>));
  act(()=>host.querySelector<HTMLButtonElement>('[data-test-select]')!.click());
  expect(host.querySelector('[data-current-ms]')?.getAttribute('data-current-ms')).toBe('10750');
  expect(host.querySelector('output[aria-label="Time"]')?.textContent).toBe('00:00:10.750');
  expect(selection).toHaveBeenCalledTimes(1);
  act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Stop"]')!.click());
  expect(host.querySelector('output[aria-label="Time"]')?.textContent).toBe('00:00:00.000');
  act(()=>host.querySelector<HTMLButtonElement>('[data-test-select]')!.click());
  expect(host.querySelector('[data-current-ms]')?.getAttribute('data-current-ms')).toBe('10750');
 }finally{act(()=>root.unmount());host.remove();}
});

it('keeps confirmed repeated 100 BPM imports at the 120 reference and keeps the metronome in the expanded options',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const score={initialTempo:120,tempoMarksConfirmed:true,initialTimeSignature:[4,4],tracks:[{measures:Array.from({length:6},(_,i)=>({number:i+1,...(i%2===0?{tempoChange:100}:{}),voices:[{events:[{kind:'note',midi:60,durationQN:1},{kind:'rest',durationQN:.5},{kind:'note',midi:60,durationQN:.5}]}]}))}]} as never;
 try{
  act(()=>root.render(<ScoreDesk exerciseTempo score={score} trackIndex={0} currentMs={0} hasSelection={false} onApply={()=>{}} onEdit={()=>{}} onDelete={()=>{}}/>));
  act(()=>host.querySelector<HTMLButtonElement>('[data-test-select]')!.click());
  expect(host.querySelector('[data-current-ms]')?.getAttribute('data-current-ms')).toBe('10750');
  expect(host.querySelector('.lmm-transport-tempo output')?.textContent).toBe('120 BPM');
  expect(host.querySelector('.lmm-transport-strip [aria-label="Metronome"]')).toBeNull();
  act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Show playback options"]')!.click());
  const metro=host.querySelector<HTMLButtonElement>('[data-palette="playback"] [aria-label="Metronome"]')!;
  expect(metro.closest('[hidden]')).toBeNull();expect(metro.getAttribute('aria-pressed')).toBe('true');
  act(()=>metro.click());expect(metro.getAttribute('aria-pressed')).toBe('false');
 }finally{act(()=>root.unmount());host.remove();}
});

it('bounds floating palette height to its frame and gives the body its own scroll area',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const bounds=vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockImplementation(()=>({top:80,bottom:400,left:0,right:800,width:800,height:320,x:0,y:80,toJSON(){}}));
 const oldHeight=window.innerHeight;
 try{
  Object.defineProperty(window,'innerHeight',{configurable:true,value:700});
  act(()=>root.render(<ScoreDesk score={{} as never} trackIndex={0} currentMs={0} hasSelection={false} onApply={()=>{}} onEdit={()=>{}} onDelete={()=>{}}/>));
  const palette=host.querySelector<HTMLElement>('[data-palette="playback"]')!;
  expect(palette.style.maxHeight).toBe('312px');
  expect(palette.querySelector('[data-palette-scroll] form')).not.toBeNull();
  expect(palette.querySelector('.lmm-palette-header')?.closest('[data-palette-scroll]')).toBeNull();
  Object.defineProperty(window,'innerHeight',{configurable:true,value:240});
  act(()=>window.dispatchEvent(new Event('resize')));
  expect(palette.style.maxHeight).toBe('152px');
  const wheel=new WheelEvent('wheel',{bubbles:true,cancelable:true,deltaX:40});
  act(()=>palette.querySelector('[data-palette-scroll]')!.dispatchEvent(wheel));
  expect(wheel.defaultPrevented).toBe(false);
 }finally{act(()=>root.unmount());host.remove();bounds.mockRestore();Object.defineProperty(window,'innerHeight',{configurable:true,value:oldHeight});}
});

it('jumps to a numbered measure with Go or Enter independently of other form fields',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const score={initialTempo:120,initialTimeSignature:[4,4],tracks:[{measures:Array.from({length:6},(_,i)=>({number:i+1,voices:[{events:[{kind:'rest',durationQN:4}]}]}))}]} as never;
 try{
  act(()=>root.render(<ScoreDesk score={score} trackIndex={0} currentMs={0} hasSelection={false} onApply={()=>{}} onEdit={()=>{}} onDelete={()=>{}}/>));
  act(()=>host.querySelector<HTMLButtonElement>('[aria-label="Show playback options"]')!.click());
  const input=host.querySelector<HTMLInputElement>('input[id$="-jump"]')!;
  const enterValue=(value:string)=>act(()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,value);input.dispatchEvent(new Event('input',{bubbles:true}));});
  const go=Array.from(host.querySelectorAll('button')).find(button=>button.textContent==='Go')!;
  enterValue('4');
  act(()=>go.click());
  expect(host.querySelector('[data-current-ms]')?.getAttribute('data-current-ms')).toBe('6000');
  enterValue('2');
  act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
  expect(host.querySelector('[data-current-ms]')?.getAttribute('data-current-ms')).toBe('2000');
  enterValue('99');expect(go.disabled).toBe(true);
  act(()=>input.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true})));
  expect(host.querySelector('[data-current-ms]')?.getAttribute('data-current-ms')).toBe('2000');
 }finally{act(()=>root.unmount());host.remove();}
});
