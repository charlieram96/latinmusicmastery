// @vitest-environment jsdom
import React,{act} from 'react';
import {createRoot} from 'react-dom/client';
import {it,expect,vi} from 'vitest';
import {SiblingSyncGuides} from '../sibling-sync-guides';
import type {LaneSection} from '../../sync/sections-lane';
it('shows the inactive score beat/note points and activates their owner without editing timing',()=>{
 Object.assign(globalThis,{IS_REACT_ACT_ENVIRONMENT:true});
 const section:LaneSection={sectionId:'second',label:'Second',startSeconds:10,endSeconds:12,
 score:{schemaVersion:1,title:'Second',sourceFormat:'native',initialTempo:120,initialTimeSignature:[4,4],initialKeyFifths:0,tracks:[{index:0,instrument:'perc-timbal',displayName:'Timbal',tuning:null,stringMultiplicity:1,channel:null,defaultView:'staff',measures:[{number:1,voices:[{number:1,events:[{kind:'note',durationQN:1,midi:60}]}]}]}]},
 timing:{method:'drag',params:{},anchor:null,waypoints:[{musicalPositionQN:0,videoTimeSeconds:10,measureNumber:1,beatInMeasure:1},{musicalPositionQN:4,videoTimeSeconds:12,measureNumber:null,beatInMeasure:null}]}};
 const original=JSON.stringify(section),onActivate=vi.fn();const host=document.createElement('div');document.body.append(host);const root=createRoot(host);
 act(()=>root.render(<SiblingSyncGuides sections={[section]} activeSectionId="first" height={120} pixelsPerSecond={100} scrollLeftPx={900} viewportWidth={500} showNotes onActivate={onActivate}/>));
 const points=host.querySelectorAll('[role="button"]');expect(points.length).toBe(5);
 act(()=>{points[0].dispatchEvent(new MouseEvent('pointerdown',{bubbles:true}));points[0].dispatchEvent(new MouseEvent('click',{bubbles:true}));});
 expect(onActivate).toHaveBeenCalledWith('second');expect(JSON.stringify(section)).toBe(original);
 act(()=>root.render(<SiblingSyncGuides sections={[section]} activeSectionId="second" height={120} pixelsPerSecond={100} scrollLeftPx={900} viewportWidth={500} showNotes onActivate={onActivate}/>));
 expect(host.querySelectorAll('[role="button"]').length).toBe(0);
 act(()=>root.unmount());host.remove();
});
