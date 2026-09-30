// @vitest-environment jsdom
import {it,expect,vi} from 'vitest';
import {installSymbolEditing} from '../notation/symbol-editing';
it('drags in notation coordinates and deletes only the symbol after a redraw',async()=>{
 class Point {constructor(public x:number,public y:number){} matrixTransform(){return {x:this.x/2,y:this.y/2};}}
 vi.stubGlobal('DOMPoint',Point);
 const root=document.createElement('div');
 root.innerHTML='<svg><g><g data-notation-symbol=\'{"eventId":"a","symbol":"dynamic"}\' data-offset-x="4" data-offset-y="6"><path/></g></g></svg>';
 document.body.append(root);
 const group=root.querySelector('[data-notation-symbol]') as SVGGElement;
 group.getBoundingClientRect=()=>({left:20,right:40,top:20,bottom:40,width:20,height:20} as DOMRect);
 (group.parentNode as SVGGraphicsElement).getScreenCTM=()=>({inverse:()=>({})} as DOMMatrix);
 const edit=vi.fn();const cleanup=installSymbolEditing(root,edit);
 const pointer=(name:string,x:number,y:number)=>root.dispatchEvent(new MouseEvent(name,{bubbles:true,clientX:x,clientY:y,button:0}));
 pointer('pointerdown',25,25);pointer('pointermove',45,65);pointer('pointerup',45,65);
 expect(edit).toHaveBeenCalledWith({eventId:'a',symbol:'dynamic'},{x:14,y:26});
 expect(group.getAttribute('transform')).toBe('translate(14 26)');
 group.replaceWith(group.cloneNode(true));await Promise.resolve();
 const deleted=new KeyboardEvent('keydown',{key:'Delete',bubbles:true,cancelable:true});window.dispatchEvent(deleted);
 expect(deleted.defaultPrevented).toBe(true);
 expect(edit).toHaveBeenLastCalledWith({eventId:'a',symbol:'dynamic'},undefined,true);
 cleanup();root.remove();vi.unstubAllGlobals();
});
