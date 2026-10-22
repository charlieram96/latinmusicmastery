import {describe,it,expect} from 'vitest';
import {timelineGaps,emptyTimelineMeasures} from '../continuous-project';
import {prepareImportedInstrument} from '../import-staves';
import type {ScoreDocument} from '@/components/playsense-studio/shared/score-model/types';
const score:ScoreDocument={schemaVersion:1,title:'Music',sourceFormat:'native',initialTempo:120,initialTimeSignature:[4,4],initialKeyFifths:0,tracks:[{index:0,instrument:'staff',displayName:'Music',tuning:null,stringMultiplicity:1,channel:null,defaultView:'staff',measures:[{number:1,voices:[{number:1,events:[{kind:'note',midi:60,durationQN:1}]}]}]}]};
describe('continuous project',()=>{
 it('divides empty spans into bars and preserves the following anchor',()=>{
 expect(emptyTimelineMeasures(0,7.6,120,[4,4])).toEqual([{start:0,end:2},{start:2,end:4},{start:4,end:6},{start:6,end:7.6}]);
 expect(emptyTimelineMeasures(10,14,90,[3,4])).toEqual([{start:10,end:12},{start:12,end:14}]);
 });
 it('keeps introductory, middle and trailing gaps empty without inventing rests',()=>{
 const ranges=[{startSeconds:14,endSeconds:35},{startSeconds:40,endSeconds:48}];const before=JSON.stringify(ranges);
 expect(timelineGaps(ranges,79)).toEqual([{start:0,end:14},{start:35,end:40},{start:48,end:79}]);expect(JSON.stringify(ranges)).toBe(before);
 });
 it('does not create negative gaps for adjacent or overlapping fragments',()=>expect(timelineGaps([{startSeconds:0,endSeconds:10},{startSeconds:8,endSeconds:20}],20)).toEqual([]));
 it.each(['piano','harp','guitar'] as const)('prepares two staves for %s without moving or duplicating notes',instrument=>{
 const result=prepareImportedInstrument(score,0,instrument);expect(result.tracks).toHaveLength(2);expect(result.tracks[0].measures[0].voices[0].events).toEqual(score.tracks[0].measures[0].voices[0].events);expect(result.tracks[1].measures[0].voices[0].events).toEqual([]);expect(score.tracks).toHaveLength(1);
 });
 it('keeps percussion on one staff with percussion clef',()=>{const result=prepareImportedInstrument(score,0,'perc-timbal');expect(result.tracks).toHaveLength(1);expect(result.tracks[0].measures[0].clef).toBe('percussion');});
});
