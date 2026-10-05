import { afterEach, describe, expect, it, vi } from 'vitest'
import { attachLatencyRecorder, type LiveAudioInput } from '../live-audio-input'
function session() {
  const node=()=>({connect:vi.fn(),disconnect:vi.fn(),gain:{value:1},port:{close:vi.fn()}})
  vi.stubGlobal('AudioWorkletNode',class{connect=vi.fn();disconnect=vi.fn();port={close:vi.fn()}})
  const context={state:'running',resume:vi.fn().mockResolvedValue(undefined),close:vi.fn(),audioWorklet:{addModule:vi.fn().mockResolvedValue(undefined)},createMediaStreamSource:vi.fn(node),createGain:vi.fn(node),destination:{}}
  const stop=vi.fn(), stream={active:true,getTracks:()=>[{stop}]}
  return {context,stream,stop,live:{context,stream} as unknown as LiveAudioInput}
}
afterEach(()=>vi.unstubAllGlobals())
describe('latency recorder borrows the active audio session',()=>{
  it('repeats on the same context and stream without reopening or stopping either',async()=>{
    const s=session()
    const first=await attachLatencyRecorder(s.live);first.dispose();first.dispose()
    const second=await attachLatencyRecorder(s.live);second.dispose()
    expect(s.context.audioWorklet.addModule).toHaveBeenCalledTimes(1)
    expect(s.context.createMediaStreamSource).toHaveBeenNthCalledWith(1,s.stream)
    expect(s.context.createMediaStreamSource).toHaveBeenNthCalledWith(2,s.stream)
    expect(s.context.close).not.toHaveBeenCalled();expect(s.stop).not.toHaveBeenCalled()
    expect(first.node.disconnect).toHaveBeenCalledTimes(1)
  })
  it('uses the existing detector source and disconnects only the diagnostic branch',async()=>{
    const s=session()
    const source={connect:vi.fn(),disconnect:vi.fn()}
    const recorder=await attachLatencyRecorder({...s.live,source:source as unknown as MediaStreamAudioSourceNode})
    recorder.dispose()
    expect(s.context.createMediaStreamSource).not.toHaveBeenCalled()
    expect(source.disconnect).toHaveBeenCalledWith(recorder.node)
    expect(s.stop).not.toHaveBeenCalled()
  })
  it('rejects an input that ends while the worklet is loading',async()=>{
    const s=session()
    s.context.audioWorklet.addModule.mockImplementation(async()=>{s.stream.active=false})
    await expect(attachLatencyRecorder(s.live)).rejects.toThrow('Audio session ended')
    expect(s.context.createMediaStreamSource).not.toHaveBeenCalled()
  })
})
