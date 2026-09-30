// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it,vi} from 'vitest';
const actions=vi.hoisted(()=>({save:vi.fn(async()=>({data:{}})),load:vi.fn(async()=>({data:{bpm:120,anchorSeconds:null}}))}));
vi.mock('@/app/actions/playsense-studio',()=>({getLessonMetronome:actions.load,saveLessonMetronome:actions.save}));
vi.mock('@/lib/supabase/client',()=>({createClient:()=>({})}));
vi.mock('@/lib/playsense-studio/waveform-decode',()=>({loadOrComputePeaks:async()=>({durationSeconds:20,data:[],bucketCount:0})}));
vi.mock('../../player/state/use-video-click-track',()=>({useVideoClickTrack:()=>{}}));
vi.mock('../../sync/waveform-canvas',()=>({WaveformCanvas:({onSeek}:{onSeek:(t:number)=>void})=><button onClick={()=>onSeek(4.25)}>Wave point</button>}));
import {LessonMetronomeEditor} from '../lesson-metronome-editor';
it('does not save a mouse preview until confirmed and keeps its anchor when changing BPM',async()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});vi.stubGlobal('ResizeObserver',class{observe(){}disconnect(){}});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const click=async(text:string)=>{const b=Array.from(host.querySelectorAll('button')).find(b=>b.textContent===text)!;await act(async()=>b.click());};
 try{
  await act(async()=>root.render(<LessonMetronomeEditor classItemId="lesson" videoUrl="/video.mp4" durationSeconds={20}/>));
  expect(host.querySelector<HTMLInputElement>('[aria-label="Metronome BPM"]')!.value).toBe('120');
  await click('Place metronome at playhead');await click('Wave point');expect(actions.save).not.toHaveBeenCalled();
  await click('Confirm metronome');expect(actions.save).toHaveBeenLastCalledWith({classItemId:'lesson',bpm:120,anchorSeconds:4.25});
  const input=host.querySelector<HTMLInputElement>('[aria-label="Metronome BPM"]')!;
  await act(async()=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value')!.set!.call(input,'90');input.dispatchEvent(new Event('input',{bubbles:true}));});
  await click('Confirm metronome');expect(actions.save).toHaveBeenLastCalledWith({classItemId:'lesson',bpm:90,anchorSeconds:4.25});
 }finally{await act(async()=>root.unmount());host.remove();vi.unstubAllGlobals();}
});
