// @vitest-environment jsdom
import { expect, it, vi } from 'vitest';
import { installScoreSelection, type ScoreHit } from '../notation/score-selection';

it('selects one chord member, drags across notes or bar headers, and clears outside', () => {
  const surface = document.createElement('div'); document.body.appendChild(surface);
  const hits: ScoreHit[] = [
    {id:'bar1', kind:'measure',track:0,measure:0,x:0,y:0,width:100,height:20},
    {id:'bar2', kind:'measure',track:0,measure:1,x:100,y:0,width:100,height:20},
    {id:'high', kind:'note',track:0,measure:0,voice:0,event:0,member:1,x:40,y:40,width:16,height:10},
    {id:'low', kind:'note',track:0,measure:0,voice:0,event:0,member:0,x:40,y:60,width:16,height:10},
  ];
  const selection = new Set<string>(); const change = vi.fn();
  const clean = installScoreSelection(surface,hits,selection,change);
  const pointer = (el: Element, type: string,x:number,y:number) => {
    const event = new MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});
    Object.defineProperty(event,'pointerId',{value:1}); el.dispatchEvent(event);
  };
  try {
    const high=surface.querySelector('[data-score-selection="high"]')!;
    pointer(high,'pointerdown',45,45); pointer(surface,'pointerup',45,45);
    expect([...selection]).toEqual(['high']);
    expect(high.getAttribute('aria-pressed')).toBe('true');
    pointer(high,'pointerdown',45,45); pointer(surface,'pointermove',57,72); pointer(surface,'pointerup',57,72);
    expect([...selection]).toEqual(['high','low']);
    const bar=surface.querySelector('[data-score-selection="bar1"]')!;
    pointer(bar,'pointerdown',10,10); pointer(surface,'pointermove',150,15); pointer(surface,'pointerup',150,15);
    expect([...selection]).toEqual(['bar1','bar2']);
    pointer(document.body,'pointerdown',500,500);
    expect(selection.size).toBe(0);
    expect(change).toHaveBeenLastCalledWith([]);
  } finally { clean(); surface.remove(); }
});

it('selects a Sync bar from its body, but a body drag selects only intersected notes', () => {
  const surface=document.createElement('div');document.body.appendChild(surface);
  const hits:ScoreHit[]=[
    {id:'bar',kind:'measure',track:0,measure:0,x:0,y:0,width:200,height:140,highlightRegions:[{y:0,height:20},{x:0,width:200,y:45,height:40}]},
    {id:'a',kind:'note',track:0,measure:0,voice:0,event:0,x:30,y:50,width:12,height:10},
    {id:'b',kind:'note',track:0,measure:0,voice:0,event:1,x:80,y:50,width:12,height:10},
    {id:'c',kind:'note',track:0,measure:0,voice:0,event:2,x:150,y:50,width:12,height:10},
  ];
  const selected=new Set<string>(),change=vi.fn();
  const clean=installScoreSelection(surface,hits,selected,change,{measureHeaderHeight:20});
  const pointer=(el:Element,type:string,x:number,y:number)=>{
    const e=new MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});
    Object.defineProperty(e,'pointerId',{value:1});el.dispatchEvent(e);
  };
  const bar=surface.querySelector('[data-score-selection="bar"]')!;
  try {
    pointer(bar,'pointerdown',15,75);pointer(surface,'pointerup',15,75);
    expect([...selected]).toEqual(['bar']);
    pointer(bar,'pointerdown',15,30);pointer(surface,'pointerup',15,30);
    expect([...selected]).toEqual([]);
    pointer(bar,'pointerdown',15,10);pointer(surface,'pointerup',15,10);
    expect([...selected]).toEqual(['bar']);
    pointer(bar,'pointerdown',15,110);pointer(surface,'pointerup',15,110);
    expect([...selected]).toEqual([]);
    pointer(bar,'pointerdown',0,40);pointer(surface,'pointermove',200,90);pointer(surface,'pointerup',200,90);
    expect([...selected]).toEqual(['bar']);
    expect((surface.lastElementChild as HTMLElement).style.display).toBe('none');
    pointer(bar,'pointerdown',20,45);pointer(surface,'pointermove',105,70);pointer(surface,'pointerup',105,70);
    expect([...selected]).toEqual(['a','b']);
    expect(change.mock.lastCall?.[0].map((h:ScoreHit)=>h.id)).toEqual(['a','b']);
    const box=surface.lastElementChild as HTMLElement;
    expect(box.style.display).toBe('block');
    expect(box.style.width).toBe('85px');
    pointer(bar,'pointerdown',105,70);pointer(surface,'pointermove',20,45);pointer(surface,'pointerup',20,45);
    expect([...selected]).toEqual(['a','b']);
    pointer(surface.querySelector('[data-score-selection="c"]')!,'pointerdown',155,55);pointer(surface,'pointerup',155,55);
    expect([...selected]).toEqual(['c']);
    expect(box.style.display).toBe('none');
    pointer(document.body,'pointerdown',300,300);expect(selected.size).toBe(0);
  }finally{clean();surface.remove();}
});

it.each([undefined, 20])('uses Shift for musical ranges across rows and Command for individual toggles (header %s)', header => {
 const surface=document.createElement('div');document.body.appendChild(surface);
 const hits:ScoreHit[]=Array.from({length:6},(_,i)=>({id:`m${i}`,kind:'measure' as const,track:0,measure:i,x:(i%3)*100,y:Math.floor(i/3)*100,width:100,height:40}));
 hits.push(...Array.from({length:6},(_,i)=>({id:`n${i}`,kind:'note' as const,track:0,measure:i,voice:0,event:0,x:(i%3)*100+40,y:Math.floor(i/3)*100+10,width:10,height:10})));
 const selected=new Set<string>(),change=vi.fn();
 let clean=installScoreSelection(surface,hits,selected,change,{measureHeaderHeight:header});
 const click=(id:string,mod:MouseEventInit={})=>{
  const hit=hits.find(h=>h.id===id)!;
  const button=surface.querySelector(`[data-score-selection="${id}"]`)!;
  for(const type of ['pointerdown','pointerup']){
   const e=new MouseEvent(type,{bubbles:true,button:0,clientX:hit.x+1,clientY:hit.y+1,...mod});Object.defineProperty(e,'pointerId',{value:1});(type==='pointerdown'?button:surface).dispatchEvent(e);
  }
 };
 try{
  click('m0');click('m5',{shiftKey:true});expect([...selected]).toEqual(['m0','m1','m2','m3','m4','m5']);
  click('m2',{shiftKey:true});expect([...selected]).toEqual(['m0','m1','m2']);
  click('m5');click('m2',{shiftKey:true});expect([...selected]).toEqual(['m2','m3','m4','m5']);
  click('m0');click('m5',{metaKey:true});expect([...selected]).toEqual(['m0','m5']);
  click('m0',{metaKey:true});expect([...selected]).toEqual(['m5']);
  click('n1',{metaKey:true});expect([...selected]).toEqual(['m5','n1']);
  click('n1');
  // Rebuilds caused by zoom/layout keep the logical anchor, not DOM coordinates.
  clean();surface.replaceChildren();clean=installScoreSelection(surface,hits,selected,change,{measureHeaderHeight:header});
  click('n4',{shiftKey:true});expect([...selected]).toEqual(['n1','n2','n3','n4']);
  click('n2',{metaKey:true});expect([...selected]).toEqual(['n1','n3','n4']);
 }finally{clean();surface.remove();}
});
