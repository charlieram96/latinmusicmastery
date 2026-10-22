import {expect,it} from 'vitest';
import {scoreMetronomeGrid,withoutScoreClicks} from '../score-metronome-grid';
import type {ScoreDocument} from '@/components/playsense-studio/shared/score-model/types';
const point=(qn:number,t:number)=>({musicalPositionQN:qn,videoTimeSeconds:t,measureNumber:null,beatInMeasure:null});
const endingScore = (bpm:number) => ({initialTempo:bpm,initialTimeSignature:[4,4],tracks:[{measures:[
 {number:1,voices:[{events:Array.from({length:4},()=>({kind:'note',durationQN:1}))}]},
 {number:2,voices:[{events:[{kind:'note',durationQN:1},...Array.from({length:3},()=>({kind:'rest',durationQN:1}))]}]},
]}]} as ScoreDocument);
it.each([100,151,188])('keeps the last three rests at the preceding %i BPM instead of squeezing them to the end marker',bpm=>{
 const beat=60/bpm, last=10+4*beat;
 const points=[point(0,10),point(4,last),point(8,last+.392)];
 const before=structuredClone(points);
 const result=scoreMetronomeGrid(endingScore(bpm),points,10,last+.392);
 expect(result).toHaveLength(8);
 result.forEach((time,i)=>expect(time).toBeCloseTo(10+i*beat,8));
 expect(points).toEqual(before);
 // No overlap with the next score or the end of the video.
 expect(scoreMetronomeGrid(endingScore(bpm),points,10,last+.392,null,last+2*beat)).toHaveLength(6);
});
it('retains alignment shifts and keeps tempo regardless of sounding notes in other tracks',()=>{
 const score=endingScore(120), points=[point(0,10),point(4,12),point(8,12.4)];
 expect(scoreMetronomeGrid(score,points,10,12.4,11).slice(-3)).toEqual([13.5,14,14.5]);
 const other=structuredClone(score.tracks[0]);
 other.measures[1].voices[0].events[3]={kind:'note',durationQN:1,midi:60};
 score.tracks.push(other);
 expect(scoreMetronomeGrid(score,points,10,12.4).slice(-3)).toEqual([12.5,13,13.5]);
});
it('regresses the recorded eight-bar 188 BPM ending at the selected tempo without changing sync points',()=>{
 const score=endingScore(188);
 score.tracks[0].measures=[...Array.from({length:7},(_,i)=>({...score.tracks[0].measures[0],number:i+1})),{...score.tracks[0].measures[1],number:8}];
 const points=[point(0,370.42),point(24,378.14993638702),point(28,379.419225365177),point(32,379.811256737816)];
 const tail=scoreMetronomeGrid(score,points,370.42,379.811256737816).slice(-4);
 const period=60/188;
 expect(tail[0]).toBeCloseTo(370.42+28*period,8);
 tail.slice(1).forEach((time,i)=>expect(time-tail[i]).toBeCloseTo(period,8));
 expect(period).toBeGreaterThan(.31);
 expect(tail[3]).toBeGreaterThan(380.3);
});
it('follows explicitly confirmed tempo changes rather than a constant initial BPM',()=>{
 const score={tempoMarksConfirmed:true,initialTempo:120,initialTimeSignature:[4,4],tracks:[{measures:[{number:1},{number:2,tempoChange:60}]}]} as ScoreDocument;
 expect(scoreMetronomeGrid(score,[point(0,10),point(4,12),point(8,16)],10,16)).toEqual([10,10.5,11,11.5,12,13,14,15]);
});
it('places six eighth-note clicks per 6/8 bar and honors a short pickup',()=>{
 const score={initialTempo:60,initialTimeSignature:[6,8],tracks:[{measures:[{number:0,durationQN:.5},{number:1}]}]} as ScoreDocument;
 expect(scoreMetronomeGrid(score,[point(0,6),point(3.5,9.5)],6,9.5)).toEqual([6,6.5,7,7.5,8,8.5,9]);
 expect(scoreMetronomeGrid(score,[point(0,6),point(3.5,9.5)],6,10,6.25)[0]).toBe(6.25);
});
it('gives unbarred whole notes four clicks each, following the saved media map',()=>{
 const score={initialTempo:100,initialTimeSignature:[4,4],tracks:[{measures:[{number:1,senzaMisura:true,voices:[{events:[{kind:'note',durationQN:4},{kind:'note',durationQN:4}]}]}]}]} as ScoreDocument;
 const grid=scoreMetronomeGrid(score,[point(0,24),point(4,26.4),point(8,28.8)],24,28.8);
 expect(grid).toHaveLength(8);
 grid.forEach((time,i)=>expect(time).toBeCloseTo(24+i*.6,8));
});

it.each([100,151,188])('ignores compressed beats and extra note anchors at %i BPM',bpm=>{
 const score=endingScore(bpm);
 const points=[point(0,3),point(4,4),point(5,4.01),point(6,4.02),point(7.5,4.03),point(8,4.04)];
 const before=structuredClone(points);
 const grid=scoreMetronomeGrid(score,points,3,4.04);
 expect(grid).toHaveLength(8);
 grid.forEach((t,i)=>expect(t).toBeCloseTo(3+i*60/bpm,8));
 expect(points).toEqual(before);
});
it('suppresses a general click underneath the score, including its final beats',()=>{
 const score=[2,2.5,3,3.5];
 expect(withoutScoreClicks([1,2,2.1,2.9,3.6,4,5],score,2,3.1)).toEqual([1,4,5]);
});

it('keeps the actual Watch section at 120 BPM past its imported second-bar 100 BPM mark',()=>{
 const score=endingScore(120);
 score.tracks[0].measures[1].tempoChange=100;
 score.tracks[0].measures.push({...score.tracks[0].measures[0],number:3});
 const before=structuredClone(score);
 const points=[point(0,.0246),point(4,2.0246),point(8,4.4246),point(12,6.8246)];
 const grid=scoreMetronomeGrid(score,points,.0246,6.8246,.0246);
 expect(grid).toHaveLength(12);
 grid.forEach((time,i)=>expect(time).toBeCloseTo(.0246+i*.5,8));
 expect(score).toEqual(before);
});
it.each([151,188])('applies a selected %i BPM transport override only once',bpm=>{
 const score=endingScore(120);
 score.playbackTempoOverride=bpm;
 score.tracks[0].measures[1].tempoChange=100;
 const grid=scoreMetronomeGrid(score,[point(0,0),point(8,4.4)],0,4.4);
 const rate=bpm/score.initialTempo;
 grid.slice(1).forEach((t,i)=>expect((t-grid[i])/rate).toBeCloseTo(60/bpm,8));
});
