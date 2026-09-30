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
