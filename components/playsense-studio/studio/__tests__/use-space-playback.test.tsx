// @vitest-environment jsdom
import {act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {useSpacePlayback} from '../use-space-playback';
it('uses the active transport from editing buttons, ignores typing/repeats/dialogs, and releases native clicks',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 const score=vi.fn(),sync=vi.fn();
 function View({linear=false}:{linear?:boolean}){useSpacePlayback(!linear,score);useSpacePlayback(linear,sync);return <><button>Delete note</button><input/><div contentEditable suppressContentEditableWarning>Text</div></>;}
 const key=(target:Element,type='keydown',extra:KeyboardEventInit={})=>{const e=new KeyboardEvent(type,{key:' ',code:'Space',bubbles:true,cancelable:true,...extra});act(()=>{target.dispatchEvent(e);});return e;};
 try {
  act(()=>root.render(<View/>));const button=host.querySelector('button')!;
  expect(key(button).defaultPrevented).toBe(true);expect(score).toHaveBeenCalledTimes(1);expect(sync).not.toHaveBeenCalled();
  key(button,'keydown',{repeat:true});expect(score).toHaveBeenCalledTimes(1);
  expect(key(button,'keyup').defaultPrevented).toBe(true);
  expect(key(host.querySelector('input')!).defaultPrevented).toBe(false);
  key(host.querySelector('[contenteditable]')!);key(button,'keydown',{ctrlKey:true});expect(score).toHaveBeenCalledTimes(1);
  const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.setAttribute('aria-modal','true');host.append(dialog);key(button);expect(score).toHaveBeenCalledTimes(1);dialog.remove();
  const input=host.querySelector('input')!;input.focus();
  act(()=>host.dispatchEvent(new MouseEvent('pointerdown',{bubbles:true})));
  expect(document.activeElement).not.toBe(input);
  const range=document.createElement('input');range.type='range';host.append(range);
  key(range);expect(score).toHaveBeenCalledTimes(2);
  act(()=>root.render(<View linear/>));key(button);expect(sync).toHaveBeenCalledTimes(1);expect(score).toHaveBeenCalledTimes(2);
 }finally{act(()=>root.unmount());host.remove();}
});
