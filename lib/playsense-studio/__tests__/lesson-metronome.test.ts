import {expect,it} from 'vitest';
import {lessonMetronomeGrid} from '../lesson-metronome';
it('waits for confirmation and begins exactly on the selected first beat',()=>{
 expect(lessonMetronomeGrid({bpm:120,anchorSeconds:null},5)).toEqual([]);
 expect(lessonMetronomeGrid({bpm:120,anchorSeconds:2.25},4)).toEqual([2.25,2.75,3.25,3.75]);
});
it('keeps the anchor when BPM changes and hands over without double clicking at the next score',()=>{
 expect(lessonMetronomeGrid({bpm:60,anchorSeconds:2.25},10,[8,5.25])).toEqual([2.25,3.25,4.25]);
 expect(lessonMetronomeGrid({bpm:120,anchorSeconds:2.25},10,[5.25])).toEqual([2.25,2.75,3.25,3.75,4.25,4.75]);
});
it('plays only authored illustration windows, leaving narration silent',()=>{
 expect(lessonMetronomeGrid({bpm:100,anchorSeconds:null,segments:[{from:5,to:6.8,bpm:100},{from:10,to:11,bpm:120}]},20)).toEqual([5,5.6,6.2,10,10.5]);
});
