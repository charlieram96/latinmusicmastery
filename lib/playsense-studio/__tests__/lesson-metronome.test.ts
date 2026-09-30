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
