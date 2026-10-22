import {describe,it,expect} from 'vitest';
import {padContinuousSection} from '../continuous-editable';
import {applyMeasureEdit} from '../measure-edits';
import type {ScoreDocument} from '@/components/playsense-studio/shared/score-model/types';
import type {StudioTiming} from '../drafts/timing';
const score:ScoreDocument={schemaVersion:1,title:'Music',sourceFormat:'native',initialTempo:100,initialTimeSignature:[4,4],initialKeyFifths:0,tracks:[{index:0,instrument:'perc-timbal',displayName:'Timbal',tuning:null,stringMultiplicity:1,channel:null,defaultView:'staff',measures:[{number:1,voices:[{number:1,events:[{kind:'note',midi:60,durationQN:1,id:'note1'}]}]}]}]};
const timing:StudioTiming={method:'drag',params:{nudges:[{qn:1,deltaSeconds:.03}],editedBeats:[{measure:0,beat:2}]},anchor:{seconds:7.6,qn:0},waypoints:[{musicalPositionQN:0,videoTimeSeconds:7.6,measureNumber:1,beatInMeasure:1},{musicalPositionQN:4,videoTimeSeconds:10,measureNumber:null,beatInMeasure:null}]};
describe('editable continuous bars',()=>{
 it('creates actual selectable/deletable bars with no rests and preserves media anchors and note data',()=>{
 const result=padContinuousSection(score,timing,0,14.8);
 expect(result.before).toBe(3);expect(result.after).toBe(2);
 expect(result.score.tracks[0].measures.slice(0,3).every(m=>m.voices[0].events.length===0)).toBe(true);
 expect(result.score.tracks[0].measures[3].voices).toEqual(score.tracks[0].measures[0].voices);
 expect(result.timing.waypoints.find(w=>w.musicalPositionQN===12)?.videoTimeSeconds).toBe(7.6);
 expect(result.timing.anchor).toEqual({seconds:7.6,qn:12});
 expect(result.timing.params.nudges).toEqual([{qn:13,deltaSeconds:.03}]);
 const deleted=applyMeasureEdit(result.score,{type:'delete-measures',trackIndex:0,start:0,count:3});
 expect(deleted.ok).toBe(true);if(deleted.ok)expect(deleted.score.tracks[0].measures[0].voices).toEqual(score.tracks[0].measures[0].voices);
 expect(timing.anchor?.qn).toBe(0);expect(score.tracks[0].measures).toHaveLength(1);
 });
});
