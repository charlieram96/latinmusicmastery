export interface LiveAudioInput { context: AudioContext; stream: MediaStream; source?: MediaStreamAudioSourceNode }
const modules = new WeakMap<AudioContext, Promise<void>>()
/** Attach a temporary recorder to the existing input; never own or stop its stream/context. */
export async function attachLatencyRecorder({ context, stream, source }: LiveAudioInput) {
  const available = () => context.state !== 'closed' && stream.active
  if (!available()) throw new Error('Audio session unavailable')
  await context.resume()
  let loaded = modules.get(context)
  if (!loaded) {
    loaded = context.audioWorklet.addModule('/audio-worklets/latency-recorder.js?v=diagnostic-3')
    modules.set(context, loaded)
    loaded.catch(() => modules.delete(context))
  }
  await loaded
  if (!available()) throw new Error('Audio session ended')
  const input = source ?? context.createMediaStreamSource(stream)
  const node = new AudioWorkletNode(context, 'latency-recorder-v3', { numberOfInputs: 2, channelCount: 1, channelCountMode: 'explicit' })
  const sink = context.createGain()
  sink.gain.value = 0
  input.connect(node); node.connect(sink); sink.connect(context.destination)
  let disposed = false
  return { node, dispose: () => {
    if (disposed) return
    disposed = true
    input.disconnect(node); node.port.close(); node.disconnect(); sink.disconnect()
  } }
}
