// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { MusicPalettes } from '../music-palettes';
vi.mock('@/components/language-provider',()=>({useTranslation:()=>({locale:'en'})}));
vi.mock('../use-studio-text',()=>({useStudioText:()=>((s:string)=>s)}));
vi.mock('../palette-glyph',()=>({PaletteGlyph:({glyph}:{glyph:string})=><span>{glyph}</span>}));
it('preserves the selected measure through pointerdown, then applies an ending only on request',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,ResizeObserver:class{observe(){} disconnect(){}}});
 localStorage.setItem('lmm-floating-palettes-v2',JSON.stringify({panels:['common:Repeticiones y navegación']}));
 const host=document.createElement('div');document.body.appendChild(host);const root=createRoot(host);
 const apply=vi.fn();let selected=true;
 const clear=(e:Event)=>{if(!(e.target as Element).closest('[data-score-preserve-selection]'))selected=false;};
 document.addEventListener('pointerdown',clear);
 try {
  await act(async()=>root.render(<MusicPalettes hasSelection={false} hasMeasureSelection onApply={apply} open={false} onCloseMenu={()=>{}}/>));
  expect(apply).not.toHaveBeenCalled();
  const ending=host.querySelector('button[aria-label="First ending"]') as HTMLButtonElement;
  expect(ending.dataset.commandStatus).toBe('ready');
  await act(async()=>{ending.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));ending.click();});
  const button=Array.from(host.querySelectorAll('button')).find(b=>b.textContent==='Aplicar a la selección')!;
  await act(async()=>{button.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));button.click();});
  expect(selected).toBe(true);expect(apply).toHaveBeenCalledExactlyOnceWith('First ending');
 } finally {document.removeEventListener('pointerdown',clear);await act(async()=>root.unmount());host.remove();localStorage.clear();}
});

it('opens inside the score, then lets playback and symbol palettes leave the frame without losing selection',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true,ResizeObserver:class{observe(){}disconnect(){}}});
 localStorage.setItem('lmm-floating-palettes-v2',JSON.stringify({panels:['common:Main','playback']}));
 const host=document.createElement('div');host.style.overflow='hidden';document.body.appendChild(host);const root=createRoot(host);
 const apply=vi.fn();
 try{
  await act(async()=>root.render(<MusicPalettes hasSelection hasMeasureSelection onApply={apply} open={false} onCloseMenu={()=>{}} playback={<button>Play test</button>}/>));
  for(const key of ['common:Main','playback']){
   const panel=host.querySelector<HTMLElement>(`[data-palette="${key}"]`)!;
   expect(panel).toBeTruthy();
   vi.spyOn(panel,'getBoundingClientRect').mockReturnValue({x:400,y:350,left:400,top:350,width:224,height:150,right:624,bottom:500,toJSON:()=>{}});
   const header=panel.querySelector<HTMLElement>('.lmm-palette-header')!;
   await act(async()=>header.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true,button:0,clientX:410,clientY:360})));
   await act(async()=>window.dispatchEvent(new MouseEvent('pointermove',{clientX:110,clientY:50})));
   await act(async()=>window.dispatchEvent(new MouseEvent('pointerup')));
   const moved=document.querySelector<HTMLElement>(`[data-palette="${key}"]`)!;
   expect(host.contains(moved)).toBe(false);
   expect(moved.parentElement).toBe(document.body);
   expect(moved.style.position).toBe('fixed');expect(moved.style.top).toBe('40px');expect(moved.style.left).toBe('100px');
   expect(moved.hasAttribute('data-score-preserve-selection')).toBe(true);
   expect(JSON.parse(localStorage.getItem('lmm-floating-palettes-v2')!).positions[key]).toMatchObject({x:100,y:40,floating:true});
  }
  expect(apply).not.toHaveBeenCalled();
  expect(document.querySelector('[data-palette="playback"]')?.textContent).toContain('Play test');
  await act(async()=>{document.querySelector<HTMLButtonElement>('[data-palette="playback"] .lmm-palette-close')!.click();});
  expect(document.querySelector('[data-palette="playback"]')).toBeNull();
 }finally{await act(async()=>root.unmount());host.remove();localStorage.clear();}
 expect(document.querySelector('[data-palette]')).toBeNull();
});
