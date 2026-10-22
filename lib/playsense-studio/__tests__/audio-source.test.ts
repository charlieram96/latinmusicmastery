import {describe,it,expect} from 'vitest';
import {audioTimeAt,audioPeaksOnVideo} from '../audio-source';
describe('replacement audio clock',()=>{
 it('aligns delayed and advanced audio without changing video time',()=>{expect(audioTimeAt(10,1.25)).toBe(8.75);expect(audioTimeAt(10,-.5)).toBe(10.5);});
 it('shifts waveform and detected transients together and pads silence',()=>{
  const source={version:1 as const,durationSeconds:2,bucketCount:2,sampleRate:48000,data:[-10,10,-20,20],hits:[.25,1.25]};
  expect(audioPeaksOnVideo(source,1,4)).toMatchObject({durationSeconds:4,data:[0,0,-10,10,-20,20,0,0],hits:[1.25,2.25]});
  expect(audioPeaksOnVideo(source,-1,2)).toMatchObject({data:[-20,20,0,0],hits:[.25]});
  expect(source.data).toEqual([-10,10,-20,20]);
 });
});

import {audibleClip,coveringClip,mixAudioPeaks,type AudioClip,type AudioSourceSettings} from '../audio-source';
const clip:AudioClip={id:'one',url:'/one.wav',name:'One',startSeconds:60,trimStartSeconds:5,trimEndSeconds:25,durationSeconds:30,muted:false};
it('replaces only the trimmed interval and restores original at the exact end or when muted',()=>{
 const settings:AudioSourceSettings={selected:'imported',offsetSeconds:0,clips:[clip]};
 expect(audibleClip(settings,59.999)).toBeUndefined();expect(audibleClip(settings,60)?.id).toBe('one');expect(audibleClip(settings,79.999)?.id).toBe('one');expect(audibleClip(settings,80)).toBeUndefined();
 expect(audibleClip({...settings,clips:[{...clip,muted:true}]},70)).toBeUndefined();
 expect(audibleClip({...settings,selected:'original'},70)).toBeUndefined();
});
it('muting the topmost overlapping clip reveals original, and neighboring sections remain independent',()=>{
 const top={...clip,id:'two',startSeconds:70,muted:true};const settings:AudioSourceSettings={selected:'imported',offsetSeconds:0,clips:[clip,top]};
 expect(audibleClip(settings,65)?.id).toBe('one');expect(coveringClip(settings,75)?.id).toBe('two');expect(audibleClip(settings,75)).toBeUndefined();expect(audibleClip({...settings,clips:[clip,{...top,muted:false}]},75)?.id).toBe('two');
});
it('transient analysis uses imported hits only inside enabled replacement ranges',()=>{
 const original={durationSeconds:4,bucketCount:4,data:[-.1,.1,-.2,.2,-.3,.3,-.4,.4],hits:[.5,1.5,2.5,3.5]};
 const short={...clip,startSeconds:1,trimStartSeconds:1,trimEndSeconds:3,durationSeconds:4};
 const layer={...original,data:[-.9,.9,-.8,.8,-.7,.7,-.6,.6],hits:[1.25,2.25]};
 const result=mixAudioPeaks(original as any,{selected:'imported',offsetSeconds:0,clips:[short]},new Map([['one',layer as any]]));
 expect(result.data).toEqual([-.1,.1,-.8,.8,-.7,.7,-.4,.4]);expect(result.hits).toEqual([.5,1.25,2.25,3.5]);
 expect(mixAudioPeaks(original as any,{selected:'imported',offsetSeconds:0,clips:[{...short,muted:true}]},new Map()).data).toEqual(original.data);
});
