// @vitest-environment jsdom
import React,{act,useEffect} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {Music} from 'lucide-react';
import {CompactSection} from '../compact-section';
it('compacts independently, keeps content mounted and remembers the layout',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();
 const unmount=vi.fn();
 function Engine(){useEffect(()=>()=>unmount(),[]);return <input defaultValue="saved editing state"/>;}
 const host=document.createElement('div');const root=createRoot(host);
 try{
  act(()=>root.render(<><CompactSection name="Score" storageId="score" icon={Music}><Engine/></CompactSection><CompactSection name="Video audio" storageId="video-audio" icon={Music}>wave</CompactSection></>));
  const buttons=host.querySelectorAll('button');const input=host.querySelector('input');
  act(()=>buttons[0].click());
  expect(buttons[0].getAttribute('aria-expanded')).toBe('false');
  expect(buttons[1].getAttribute('aria-expanded')).toBe('true');
  expect(host.querySelector('input')).toBe(input);expect(unmount).not.toHaveBeenCalled();
  expect(localStorage.getItem('lmm-compact-score')).toBe('true');
  act(()=>buttons[0].click());expect(buttons[0].getAttribute('aria-expanded')).toBe('true');
 }finally{act(()=>root.unmount());localStorage.clear();}
});
it('does not hide a new score because another exercise or sync view was compacted',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});localStorage.clear();
 localStorage.setItem('lmm-compact-score','true');
 const host=document.createElement('div');const root=createRoot(host);
 const render=(scope:string)=>act(()=>root.render(<CompactSection name="Score" storageId="score" storageScope={scope} icon={Music}>notes</CompactSection>));
 const expanded=()=>host.querySelector('button')!.getAttribute('aria-expanded');
 try{
  render('exercise-a:sync');expect(expanded()).toBe('true');
  act(()=>host.querySelector('button')!.click());expect(expanded()).toBe('false');
  render('exercise-b:score');expect(expanded()).toBe('true');
  render('exercise-a:score');expect(expanded()).toBe('true');
  render('exercise-a:sync');expect(expanded()).toBe('false');
 }finally{act(()=>root.unmount());localStorage.clear();}
});
