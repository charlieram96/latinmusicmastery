/** Convert viewport measurements back to the containing player's CSS pixels.
 * Ancestor transforms (the classroom board) must not scale overlays twice.
 */
export function videoLocalBounds(
 video: {left:number;top:number;width:number;height:number},
 parent: {left:number;top:number;width:number;height:number;offsetWidth:number;offsetHeight:number;clientLeft:number;clientTop:number;scrollLeft:number;scrollTop:number},
){
 const sx=parent.offsetWidth>0?parent.width/parent.offsetWidth:1
 const sy=parent.offsetHeight>0?parent.height/parent.offsetHeight:1
 const scaleX=sx>0?sx:1,scaleY=sy>0?sy:1
 return {left:(video.left-parent.left)/scaleX-parent.clientLeft+parent.scrollLeft,top:(video.top-parent.top)/scaleY-parent.clientTop+parent.scrollTop,width:video.width/scaleX,height:video.height/scaleY}
}
export function measureVideoLocalBounds(video: HTMLVideoElement, parent: HTMLElement) {
 const rect = parent.getBoundingClientRect()
 return videoLocalBounds(video.getBoundingClientRect(), {
  left: rect.left, top: rect.top, width: rect.width, height: rect.height,
  offsetWidth: parent.offsetWidth, offsetHeight: parent.offsetHeight,
  clientLeft: parent.clientLeft, clientTop: parent.clientTop,
  scrollLeft: parent.scrollLeft, scrollTop: parent.scrollTop,
 })
}
