// Records by audio frames, never by main-thread message arrival time. No mic monitor.
class LatencyRecorder extends AudioWorkletProcessor {
  constructor() {
    super()
    this.capture = null
    this.port.onmessage = ({data}) => {
      if(data.type === 'record') {
        this.start = data.startFrame
        this.capture = new Float32Array(data.length)
        this.received = 0
        this.reference = new Float32Array(data.length)
        this.nextFrame = null
        this.discontinuities = 0
        this.gaps = []
        this.zeroRun = 0
        this.maxZeroRun = 0
      }
    }
  }
  process(inputs) {
    if(!this.capture) return true
    const input = inputs[0]?.[0]
    const frames = input?.length || 128
    const reference = inputs[1]?.[0]
    if (this.nextFrame !== null && currentFrame !== this.nextFrame) {
      // The graph can start/stop rendering before the scheduled capture. Only
      // discontinuities intersecting recorded frames can invalidate this take.
      const from = Math.max(this.start, Math.min(this.nextFrame, currentFrame))
      const to = Math.min(this.start + this.capture.length, Math.max(this.nextFrame, currentFrame))
      if (to > from) {
        this.discontinuities++
        this.gaps.push({ fromFrame: from-this.start, toFrame: to-this.start })
      }
    }
    this.nextFrame = currentFrame + frames
    for(let i=0;i<frames;i++) {
      const index = currentFrame+i-this.start
      if(index>=0 && index<this.capture.length && input) {
        this.capture[index]=input[i]
        this.received++
        this.zeroRun = input[i] === 0 ? this.zeroRun + 1 : 0
        this.maxZeroRun = Math.max(this.maxZeroRun, this.zeroRun)
      }
      if(index>=0 && index<this.capture.length) this.reference[index]=reference?.[i] || 0
    }
    if(currentFrame+frames>=this.start+this.capture.length) {
      const samples=this.capture
      this.capture=null
      this.port.postMessage({samples,reference:this.reference,received:this.received,discontinuities:this.discontinuities,gaps:this.gaps,maxZeroRun:this.maxZeroRun},[samples.buffer,this.reference.buffer])
    }
    return true
  }
}
registerProcessor('latency-recorder-v3',LatencyRecorder)
