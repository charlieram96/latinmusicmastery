import {describe,it,expect} from 'vitest'
import {videoLocalBounds} from '../video-local-bounds'
describe('video overlay coordinates',()=>{
 for(const scale of [1,1.16,1.5,.75])it(`preserves local video geometry at scale ${scale}`,()=>{
 const result=videoLocalBounds({left:100+2*scale,top:60+12*scale,width:640*scale,height:360*scale},{left:100,top:60,width:644*scale,height:420*scale,offsetWidth:644,offsetHeight:420,clientLeft:2,clientTop:2,scrollLeft:0,scrollTop:0})
 expect(result.left).toBeCloseTo(0);expect(result.top).toBeCloseTo(10);expect(result.width).toBeCloseTo(640);expect(result.height).toBeCloseTo(360)
 })
 it('accounts for scrolling inside a bordered player',()=>{expect(videoLocalBounds({left:102,top:62,width:640,height:360},{left:100,top:60,width:644,height:400,offsetWidth:644,offsetHeight:400,clientLeft:2,clientTop:2,scrollLeft:8,scrollTop:10})).toEqual({left:8,top:10,width:640,height:360})})
})
