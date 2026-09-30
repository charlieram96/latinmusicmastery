import {expect,it} from 'vitest';
import type {ScoreDocument} from '@/components/playsense-studio/shared/score-model/types';
import {parseScoreDocument,serializeScoreDocument} from '@/components/playsense-studio/shared/score-model/serialization';
import {applyInstrumentLegend} from '../instrument-legend';
import {percussionEntryAtLine} from '../zoom-pointer';
import {getPercStrokes,strokeNotation} from '../perc-strokes';
import {editorReducer,type EditorState} from '../editor-state';
import {extractTrackEvents} from '../score-to-vexflow';
const doc=():ScoreDocument=>({schemaVersion:1,title:'T',sourceFormat:'native',initialTempo:120,initialTimeSignature:[4,4],initialKeyFifths:0,tracks:[{index:0,instrument:'staff',displayName:'T',tuning:null,stringMultiplicity:1,channel:null,defaultView:'staff',measures:[{number:1,voices:[{number:1,events:[{kind:'note',midi:69,durationQN:1},{kind:'chord',durationQN:1,notes:[{midi:60},{midi:64}]}]}]}]}]});
it('defaults timbal A4 to cascara plus but honors the existing technique',()=>{
 const strokes=getPercStrokes('perc-timbal')!;
 expect(percussionEntryAtLine(strokes,2.5)).toMatchObject({midi:65,percussion:{staffLine:'a/4',notehead:'plus'}});
 const high=strokes.find(s=>s.id==='high')!;
 expect(percussionEntryAtLine(strokes,2.5,[{midi:high.midi,percussion:strokeNotation(high)}])).toMatchObject({midi:64,percussion:{notehead:'normal'}});
});
it('allows a bongo note in the first space instead of snapping to the four legend strokes',()=>{
 expect(percussionEntryAtLine(getPercStrokes('perc-bongo')!,3.5).percussion).toEqual({staffLine:'f/4',notehead:'normal'});
});
it('applies the selected import legend without mutating the source or destroying explicit notation',()=>{
 const score=doc();
 const next=applyInstrumentLegend(score,0,'perc-timbal');
 expect(next.tracks[0].measures[0].voices[0].events[0]).toMatchObject({midi:65,percussion:{staffLine:'a/4',notehead:'plus'}});
 expect(score.tracks[0].instrument).toBe('staff');
 const note=next.tracks[0].measures[0].voices[0].events[0];if(note.kind!=='note')throw Error();
 note.percussion!.notehead='diamond';
 const saved=parseScoreDocument(serializeScoreDocument(applyInstrumentLegend(next,0,'perc-bongo')));
 expect(saved.tracks[0].measures[0].voices[0].events[0]).toMatchObject({percussion:{notehead:'diamond'}});
});
it('changes only selected chord members, persists heads and restores the legend with undo',()=>{
 let state:EditorState={score:doc(),past:[],future:[],isDirty:false};
 const ref={trackIndex:0,measureIndex:0,voice:0 as const,eventIndex:1,member:1};
 state=editorReducer(state,{type:'set-noteheads',refs:[ref],notehead:'plus'});
 const saved=parseScoreDocument(serializeScoreDocument(state.score));
 const e=saved.tracks[0].measures[0].voices[0].events[1];if(e.kind!=='chord')throw Error();
 expect(e.notes[0].notehead).toBeUndefined();expect(e.notes[1].notehead).toBe('plus');
 expect(extractTrackEvents(saved.tracks[0],[4,4])[0].events[1].percussion?.map(n=>n.notehead)).toEqual(['normal','plus']);
 const restored=editorReducer(state,{type:'set-noteheads',refs:[ref],notehead:null});
 expect(editorReducer(restored,{type:'undo'}).score).toEqual(state.score);
});
it('applies the original timbal stroke to a selection and keeps rhythm, rests and undo',()=>{
 const score=applyInstrumentLegend(doc(),0,'perc-timbal');
 score.tracks[0].measures[0].voices[0].events.push({kind:'rest',durationQN:2});
 const initial:EditorState={score,past:[],future:[],isDirty:false};
 const refs=[0,1,2].map(eventIndex=>({trackIndex:0,measureIndex:0,voice:0 as const,eventIndex}));
 const custom=editorReducer(initial,{type:'set-noteheads',refs,notehead:'diamond'});
 const changed=editorReducer(custom,{type:'set-legend-stroke',refs,strokeId:'cascara'});
 const events=changed.score.tracks[0].measures[0].voices[0].events;
 expect(events[0]).toMatchObject({midi:65,durationQN:1,percussion:{strokeId:'cascara',staffLine:'a/4',notehead:'plus'}});
 expect('notehead' in events[0]).toBe(false);
 expect(events[1].kind==='chord' && events[1].notes.every(n=>n.percussion?.strokeId==='cascara'&&!n.notehead)).toBe(true);
 expect(events[2]).toEqual({kind:'rest',durationQN:2});
 expect(editorReducer(changed,{type:'undo'}).score).toEqual(custom.score);
 expect(parseScoreDocument(serializeScoreDocument(changed.score)).tracks[0].measures[0].voices[0].events).toEqual(events);
});
