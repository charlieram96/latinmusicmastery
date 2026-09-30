import {describe,it,expect} from 'vitest';
import {paletteActions,PALETTE_COMMANDS} from '../palette-actions';
import {editorReducer,type EditorState,type EventRef} from '../editor-state';
import type {ScoreDocument} from '@/components/playsense-studio/shared/score-model/types';
import {extractTrackEvents} from '../score-to-vexflow';
const ref:EventRef={trackIndex:1,measureIndex:0,voice:1,eventIndex:0};
function seed():EditorState {return {score:{schemaVersion:1,title:'Palette test',sourceFormat:'native',initialTempo:90,initialTimeSignature:[4,4],initialKeyFifths:0,tracks:[0,1].map(index=>({index,staffGroup:'piano',staffNumber:index+1,instrument:'piano',displayName:'Piano',tuning:null,stringMultiplicity:1,channel:null,defaultView:'staff',measures:[{number:1,voices:[{number:1,events:[{id:`top-${index}`,kind:'note',midi:60,durationQN:4}]},{number:2,events:[{id:`a-${index}`,kind:'note',midi:60,durationQN:1},{id:`b-${index}`,kind:'note',midi:62,durationQN:1}]}]}]}))} as ScoreDocument,past:[],future:[],isDirty:false};}
function apply(s:EditorState,name:string,refs=[ref]) {const plan=paletteActions(name,s.score,refs,[]);expect(plan.error).toBeUndefined();return editorReducer(s,{type:'apply-palette-actions',actions:plan.actions});}
describe('palette edits use the shared score',()=>{
 it('keeps dynamics and ornaments on the selected lower staff and voice after saving and extracting for Sync',()=>{
  let s=apply(seed(),'dynamicMF');s=apply(s,'ornamentTrill');
  const restored=JSON.parse(JSON.stringify(s.score)) as ScoreDocument;
  const events=extractTrackEvents(restored.tracks[1],restored.initialTimeSignature,0)[0].voice2Events!;
  expect(events[0].dynamic).toBe('mf');expect(events[0].ornament).toBe('trill');
  expect(restored.tracks[0].measures[0].voices[1].events[0]).not.toHaveProperty('dynamic');
 });
 it('converts a selected note to a rest, retaining duration and a single undo',()=>{
  const before=seed(),after=apply(before,'restQuarter');
  expect(after.score.tracks[1].measures[0].voices[1].events[0]).toMatchObject({kind:'rest',durationQN:1});
  expect(after.past).toHaveLength(1);expect(editorReducer(after,{type:'undo'}).score).toEqual(before.score);
 });
 it('stores hairpin endpoints in the score and refuses spans across different staves',()=>{
  const s=seed(),end={...ref,eventIndex:1};const after=apply(s,'Crescendo',[ref,end]);
  expect(after.score.spans).toEqual(expect.arrayContaining([expect.objectContaining({type:'cresc',from:'a-1',to:'b-1'})]));
  expect(paletteActions('Crescendo',s.score,[ref,{...end,trackIndex:0}],[]).error).toBeTruthy();
 });
 it('refuses an overflowing duration without partly converting to a rest',()=>{
  const before=seed(),after=apply(before,'restWhole');expect(after).toBe(before);
 });
 it('creates sextuplets and double dots through existing musical edits',()=>{
  const s=seed();expect(apply(s,'Seisillo').score.tracks[1].measures[0].voices[1].events.length).toBe(7);
  expect(apply(s,'Doble puntillo').score.tracks[1].measures[0].voices[1].events[0].durationQN).toBe(1.75);
 });
 it('requires explicit measure selection for a clef and keeps unsupported glyphs inactive',()=>{
  expect(paletteActions('fClef',seed().score,[],[]).error).toBeTruthy();
  expect(PALETTE_COMMANDS.harpPedalRaised).toBeUndefined();
 });
});

it('moves and removes symbols without changing pitches or time, with undo and saved offsets', async()=>{
 const {parseScoreDocument,serializeScoreDocument}=await import('@/components/playsense-studio/shared/score-model/serialization');
 const original=apply(apply(seed(),'dynamicMF'),'articAccentAbove');
 const target={eventId:'a-1',symbol:'dynamic'};
 const moved=editorReducer(original,{type:'edit-symbol',target,offset:{x:12,y:-18}});
 const saved=parseScoreDocument(serializeScoreDocument(moved.score));
 const e=saved.tracks[1].measures[0].voices[1].events[0];
 expect(e).toMatchObject({kind:'note',midi:60,durationQN:1,dynamic:'mf',symbolOffsets:{dynamic:{x:12,y:-18}}});
 expect(extractTrackEvents(saved.tracks[1],saved.initialTimeSignature,0)[0].voice2Events![0].symbolOffsets).toEqual(e.symbolOffsets);
 const removed=editorReducer(moved,{type:'edit-symbol',target,remove:true});
 expect(removed.score.tracks[1].measures[0].voices[1].events[0].dynamic).toBeUndefined();
 expect(editorReducer(removed,{type:'undo'}).score).toEqual(moved.score);
 const noAccent=editorReducer(original,{type:'edit-symbol',target:{eventId:'a-1',symbol:'articulation:accent'},remove:true});
 expect(noAccent.score.tracks[1].measures[0].voices[1].events[0].articulations).toEqual([]);
});
it('saves span positioning and deletes just that span',async()=>{
 const {parseScoreDocument,serializeScoreDocument}=await import('@/components/playsense-studio/shared/score-model/serialization');
 const s=apply(seed(),'Crescendo',[ref,{...ref,eventIndex:1}]);
 const target={spanId:s.score.spans![0].id,symbol:'cresc'};
 const moved=editorReducer(s,{type:'edit-symbol',target,offset:{x:10,y:22}});
 expect(parseScoreDocument(serializeScoreDocument(moved.score)).spans![0].offset).toEqual({x:10,y:22});
 expect(editorReducer(moved,{type:'edit-symbol',target,remove:true}).score.spans).toEqual([]);
 expect(moved.score.tracks).toEqual(s.score.tracks);
});

it('applies final, double and single barlines to the selected measure with undo',()=>{
 for(const [symbol,endBarline] of [['barlineFinal','final'],['barlineDouble','double'],['barlineSingle','single']]){
  const before=seed();
  const plan=paletteActions(symbol,before.score,[],[{trackIndex:1,measureIndex:0}]);
  expect(plan.error).toBeUndefined();
  const after=editorReducer(before,{type:'apply-palette-actions',actions:plan.actions});
  expect(after.score.tracks[1].measures[0].endBarline).toBe(endBarline);
  expect(editorReducer(after,{type:'undo'}).score).toEqual(before.score);
 }
});
