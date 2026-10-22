// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
vi.mock('@/components/language-provider',()=>({useTranslation:()=>({locale:'es'})}));
vi.mock('@/lib/playsense-studio/audio-layer-analysis',()=>({clipPeaks:async()=>({durationSeconds:20,bucketCount:1,data:[-64,127]}),audioFileDuration:async()=>20}));
import {AudioSourceControls} from '../audio-source-controls';
it('keeps selection across pointerdown and sends independent mute and placement edits without extra selectors',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 vi.stubGlobal('ResizeObserver',class{observe(){} disconnect(){}});
 const clip={id:'a',url:'/a.wav',name:'A',durationSeconds:20,startSeconds:1,trimStartSeconds:2,trimEndSeconds:20,muted:false};
 const save=vi.fn(async()=>true);const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const audio={settings:{selected:'imported',offsetSeconds:0,clips:[clip]},save,loaded:true,busy:false,error:'',canUndo:false,canRedo:false,undo:vi.fn(),redo:vi.fn()};
 try{
  await act(async()=>root.render(<AudioSourceControls audio={audio as any} duration={120} getPlayhead={()=>60} sections={[{id:'score2',label:'Score 2',start:30,end:40}]}/>));
  const button=(name:string)=>Array.from(host.querySelectorAll('button')).find(b=>b.textContent?.includes(name))!;
  await act(async()=>{button('Silenciar').dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));button('Silenciar').click();});
  expect(save).toHaveBeenLastCalledWith({selected:'imported',clips:[{...clip,muted:true}]});
  const move=host.querySelector('button[aria-label="Mover audio 1: A"]')!;
  await act(async()=>move.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',shiftKey:true,bubbles:true})));
  expect(save).toHaveBeenLastCalledWith({selected:'imported',clips:[{...clip,startSeconds:2}]});
  Object.assign(move,{setPointerCapture:vi.fn()});
  Object.defineProperty(move.parentElement,'clientWidth',{value:120});
  await act(async()=>move.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,clientX:10})));
  await act(async()=>move.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,clientX:20})));
  await act(async()=>move.dispatchEvent(new MouseEvent('pointerup',{bubbles:true,clientX:20})));
  expect(save).toHaveBeenLastCalledWith({selected:'imported',clips:[{...clip,startSeconds:11}]});
  const wave=move.querySelector('svg path:last-child');
  expect(wave?.getAttribute('d')).toBe('M0.5,4V73.18110236220473');
  const remove=host.querySelector<HTMLButtonElement>('button[aria-label="Quitar audio importado 1: A"]')!;
  expect(remove.closest('[data-score-preserve-selection]')).not.toBeNull();
  await act(async()=>{remove.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));remove.click();});
  expect(save).toHaveBeenLastCalledWith({clips:[]});
  const upload=host.querySelector<HTMLInputElement>('input[type="file"]')!;
  expect(upload.hasAttribute('accept')).toBe(false);
  Object.defineProperty(upload,'files',{configurable:true,value:[new File(['audio'],'Prueba.MP3',{type:''})]});
  await act(async()=>upload.dispatchEvent(new Event('change',{bubbles:true})));
  expect(save).toHaveBeenLastCalledWith(expect.objectContaining({clips:[expect.objectContaining({name:'Prueba.MP3',durationSeconds:20})]}),expect.any(File));
  save.mockClear();
  Object.defineProperty(upload,'files',{configurable:true,value:[new File(['data'],'document.pdf')]});
  await act(async()=>upload.dispatchEvent(new Event('change',{bubbles:true})));
  expect(save).not.toHaveBeenCalled();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('MP3');
  expect(host.querySelector('select')).toBeNull();
  expect(host.textContent).not.toContain('Colocar en el cabezal');

 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
