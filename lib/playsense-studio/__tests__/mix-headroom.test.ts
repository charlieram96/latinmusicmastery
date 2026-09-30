import {expect,it} from 'vitest';
import {mixHeadroom} from '../mix-headroom';
it('keeps six coincident full-scale MP3 attacks within full scale',()=>{
 const ids=['guiro','bongo','conga','bass','tres','piano'];
 const gain=mixHeadroom(ids,new Set(ids),{});
 expect(ids.reduce(sum=>sum+.95*gain,0)).toBeCloseTo(.95);
});
it('preserves relative faders and leaves a single track or quiet mix unchanged',()=>{
 const levels={a:1,b:.5};const gain=mixHeadroom(['a','b'],new Set(['a','b']),levels);
 expect(levels.a*gain/(levels.b*gain)).toBe(2);
 expect(mixHeadroom(['a','b'],new Set(['a']),levels)).toBe(1);
 expect(mixHeadroom(['a','b'],new Set(['a','b']),{a:.2,b:.3})).toBe(1);
 expect(levels).toEqual({a:1,b:.5});
});
