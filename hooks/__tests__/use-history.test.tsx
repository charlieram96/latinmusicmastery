// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {expect,it} from 'vitest';
import {useHistory} from '../use-history';
it('uses the immediately preceding snapshot even for consecutive actions before a render',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const host=document.createElement('div');const root=createRoot(host);
 let history!:ReturnType<typeof useHistory<number>>;
 function Probe(){history=useHistory(0);return null;}
 act(()=>root.render(<Probe/>));
 act(()=>{history.commit(1);history.commit(2);expect(history.undo()).toBe(1);expect(history.undo()).toBe(0);expect(history.redo()).toBe(1);});
 expect(history.present).toBe(1);
 act(()=>history.commit(3));expect(history.canRedo).toBe(false);
 act(()=>root.unmount());
});
