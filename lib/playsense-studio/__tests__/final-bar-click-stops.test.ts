import {expect,it} from 'vitest';
import {finalBarClickStops,stopClicksAtFinalBars} from '../final-bar-click-stops';
import type {ScoreDocument} from '@/components/playsense-studio/shared/score-model/types';
const score={initialTempo:120,initialTimeSignature:[4,4],tracks:[{measures:[
 {number:1,endBarline:'final',voices:[]},{number:2,endBarline:'double',voices:[]},
 {number:3,repeatEnd:true,voices:[]},{number:4,endBarline:'final',voices:[]},
]}]} as unknown as ScoreDocument;
const points=[{musicalPositionQN:0,videoTimeSeconds:10,measureNumber:1,beatInMeasure:1},{musicalPositionQN:16,videoTimeSeconds:18,measureNumber:null,beatInMeasure:null}];
it('ends clicks at multiple synchronized final bars, never at double or repeat bars',()=>{
 expect(finalBarClickStops(score,points)).toEqual([12,18]);
 expect(stopClicksAtFinalBars([10,11,12,13,14,15,16,17,18,19],[10,15],[12,18])).toEqual([10,11,15,16,17]);
});
it('does not stop at repeat endings even when a hidden final override exists',()=>{
 const repeated=structuredClone(score);repeated.tracks[0].measures[0].repeat={id:'r',offset:0,length:1,count:2,pass:0};
 expect(finalBarClickStops(repeated,points)).toEqual([18]);
});
it('restarts exactly at a new anchor on the boundary and keeps silence when seeking past a stop',()=>{
 expect(stopClicksAtFinalBars([12,12.5,13],[12],[12])).toEqual([12,12.5,13]);
 expect(stopClicksAtFinalBars([13,14],[10],[12])).toEqual([]);
});
it('stops at the automatic final bar of an imported section',()=>{
 const automatic=structuredClone(score);
 delete automatic.tracks[0].measures[0].endBarline;
 delete automatic.tracks[0].measures[3].endBarline;
 expect(finalBarClickStops(automatic,points)).toEqual([18]);
});
