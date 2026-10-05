/** Acoustic round-trip diagnostic, not a student timing correction.
 * Both emission and capture use the AudioContext frame clock:
 * https://webaudio.github.io/web-audio-api/#AudioWorkletGlobalScope
 */
export const PROBE_COUNT = 8
export const PROBE_INTERVAL = .8
export const PROBE_DURATION = .032
export function makeLatencyProbe(rate: number): Float32Array {
  const n = Math.round(rate * PROBE_DURATION)
  return Float32Array.from({length:n}, (_, i) => {
    const t = i / rate
    // Windowed broadband chirp: distinctive enough to reject ordinary room noise.
    return .18 * Math.sin(Math.PI * i / (n - 1)) ** 2 * Math.sin(2 * Math.PI * (500 * t + 2000 / (2 * PROBE_DURATION) * t * t))
  })
}
export interface LoopbackResult {
  pulses: Array<{ delayMs: number | null; correlation: number; accepted: boolean }>
  detected: number; total: number; reliable: boolean; medianMs: number | null
  iqrMs: number | null; delaysMs: number[]; correlations: number[]; clipped: boolean
}
function quantile(values: number[], p: number) {
  const sorted = [...values].sort((a,b)=>a-b), index = (sorted.length-1)*p
  const lower = Math.floor(index)
  return sorted[lower] + (sorted[Math.ceil(index)]-sorted[lower])*(index-lower)
}
export function analyzeLoopback(recording: Float32Array, rate: number, emissionOffsets: number[]): LoopbackResult {
  // Integer decimation maintains the original frame clock. Match the identically
  // decimated transmitted waveform; 44.1k and 48k are both supported.
  const stride = Math.max(1, Math.floor(rate / 12000)), effectiveRate = rate / stride
  const signal = Float32Array.from({length:Math.floor(recording.length/stride)},(_,i)=>recording[i*stride])
  const fullProbe = makeLatencyProbe(rate)
  const probe = Float32Array.from({length:Math.floor(fullProbe.length/stride)},(_,i)=>fullProbe[i*stride])
  const probeEnergy = probe.reduce((sum,v)=>sum+v*v,0)
  const prefix = new Float64Array(signal.length+1)
  for(let i=0;i<signal.length;i++) prefix[i+1]=prefix[i]+signal[i]*signal[i]
  const energy = (start:number, length:number) => prefix[start+length]-prefix[start]
  const pulses: LoopbackResult["pulses"] = []
  const delaysMs:number[]=[], correlations:number[]=[]
  for(const emission of emissionOffsets) {
    const start = Math.max(0,Math.round(emission*effectiveRate))
    const end = Math.min(signal.length-probe.length, Math.floor((emission+.5)*effectiveRate))
    const noiseStart = Math.max(0,start-Math.round(.2*effectiveRate))
    const noisePower = energy(noiseStart,start-noiseStart)/Math.max(1,start-noiseStart)
    let best=0,bestIndex=-1
    const candidates: {index:number; score:number}[]=[]
    for(let offset=start;offset<=end;offset++) {
      const power = energy(offset,probe.length)
      if(power/probe.length < Math.max(1e-10, noisePower*4)) continue
      let dot=0
      for(let j=0;j<probe.length;j++) dot+=signal[offset+j]*probe[j]
      const score=Math.abs(dot)/Math.sqrt(power*probeEnergy)
      candidates.push({index:offset,score})
      if(score>best){best=score;bestIndex=offset}
    }
    const rival=candidates.reduce((max,c)=>Math.abs(c.index-bestIndex)>effectiveRate*.012?Math.max(max,c.score):max,0)
    // Engineering confidence gates, not universal acoustic/educational standards.
    const accepted=bestIndex>=0 && best>=.35 && best>rival*1.25
    pulses.push({delayMs:bestIndex>=0?(bestIndex/effectiveRate-emission)*1000:null,correlation:best,accepted})
    if(accepted) {
      delaysMs.push((bestIndex/effectiveRate-emission)*1000);correlations.push(best)
    }
  }
  const clipped=recording.some(v=>Math.abs(v)>=.999)
  const medianMs=delaysMs.length?quantile(delaysMs,.5):null
  const iqrMs=delaysMs.length?quantile(delaysMs,.75)-quantile(delaysMs,.25):null
  const spread=delaysMs.length?Math.max(...delaysMs)-Math.min(...delaysMs):Infinity
  return {pulses,detected:delaysMs.length,total:emissionOffsets.length,medianMs,iqrMs,delaysMs,correlations,clipped,
    reliable:emissionOffsets.length>=PROBE_COUNT && delaysMs.length>=7 && !clipped && iqrMs!<=10 && spread<=25}
}
