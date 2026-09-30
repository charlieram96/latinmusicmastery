import {it,expect} from 'vitest';
import {scorePlaybackRate,playbackTrack} from '../playback-tempo';
import type {ScoreDocument,Track} from '@/components/playsense-studio/shared/score-model/types';
it('uses each uploaded score at natural video speed and respects only its own override',()=>{
 const first={initialTempo:90},second={initialTempo:110};
 expect(scorePlaybackRate(first)).toBe(1);expect(scorePlaybackRate(second)).toBe(1);
 expect(scorePlaybackRate({...first,playbackTempoOverride:120})).toBeCloseTo(120/90);
 expect(scorePlaybackRate(second)).toBe(1);
 expect(scorePlaybackRate({...second,playbackTempoOverride:55})).toBe(.5);
});
it('takes the opening tempo from the score, preserving later changes and source data',()=>{
 const track={measures:[{number:1,tempoChange:100},{number:2,tempoChange:80}]} as Track;
 const next=playbackTrack(track,{initialTempo:120} as ScoreDocument);
 expect(next.measures.map(m=>m.tempoChange)).toEqual([120,80]);
 expect(track.measures[0].tempoChange).toBe(100);
});
it('keeps exercise playback at 120 through bar three unless tempo marks are confirmed',async()=>{
 const {exercisePlaybackScore}=await import('../playback-tempo');
 const {walkMeasures}=await import('../time-mapping');
 const score={initialTempo:120,initialTimeSignature:[4,4],tracks:[{measures:[{number:1,tempoChange:120},{number:2},{number:3,tempoChange:100}]}]} as ScoreDocument;
 const playback=exercisePlaybackScore(score);
 expect([...walkMeasures(playback.tracks[0],playback)].map(b=>b.state.tempo)).toEqual([120,120,120]);
 expect(score.tracks[0].measures[2].tempoChange).toBe(100);
 const confirmed=exercisePlaybackScore({...score,tempoMarksConfirmed:true});
 expect([...walkMeasures(confirmed.tracks[0],confirmed)].map(b=>b.state.tempo)).toEqual([120,120,100]);
});
it('normalizes repeated confirmed opening marks in both score playback and the exercise grid',async()=>{
 const {buildExerciseGrid}=await import('@/lib/play-sense/score-to-exercise');
 const {walkMeasures}=await import('../time-mapping');
 const score={initialTempo:120,initialTimeSignature:[4,4],tempoMarksConfirmed:true,tracks:[{measures:Array.from({length:6},(_,i)=>({number:i+1,voices:[],...(i%2===0?{tempoChange:100}:{})}))}]} as unknown as ScoreDocument;
 const track=playbackTrack(score.tracks[0],score);
 expect([...walkMeasures(track,score)].map(b=>b.state.tempo)).toEqual([120,120,120,120,120,120]);
 expect(buildExerciseGrid(score,score.tracks[0]).measureStartSec).toEqual([0,2,4,6,8,10,12]);
 expect(score.tracks[0].measures[2].tempoChange).toBe(100);
});
