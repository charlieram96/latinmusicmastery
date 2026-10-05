import { readFileSync } from 'node:fs'
import vm from 'node:vm'
import { expect, it } from 'vitest'
import { evaluateRhythm } from '@/lib/play-sense/rhythm-evaluation'

it('captures the completed raw clap peak rather than its initial detection energy', () => {
  const messages: Record<string,number|string>[] = []
  let Processor: any
  const sandbox = { currentTime: 1, sampleRate: 48000, AudioWorkletProcessor: class { port = { postMessage: (message: any) => messages.push(message) } }, registerProcessor: (_name: string, ctor: any) => { Processor = ctor } }
  vm.runInNewContext(readFileSync('public/audio-worklets/onset-detector-processor.js','utf8'), sandbox)
  const processor = new Processor()
  processor.pendingLevels.push({ timestamp: 1, peak: .01, rms: .001 })
  processor.process([[new Float32Array(128).fill(.6)]], [], {})
  expect(messages.some(message => message.type === 'onset-level')).toBe(false)
  sandbox.currentTime = 1.081
  processor.process([[new Float32Array(128).fill(.001)]], [], {})
  const result = messages.find(message => message.type === 'onset-level')!
  expect(result.peak).toBeCloseTo(.6)
  expect(result.rms).toBeCloseTo(.6)
  expect(result.timestamp).toBe(1)
  expect(processor.pendingLevels).toHaveLength(0)
})

it('detects quiet percussive PCM attacks above room noise and scores their rhythm', () => {
  const messages: any[] = []
  let Processor: any
  const sandbox = { currentTime: 0, sampleRate: 48000, AudioWorkletProcessor: class { port = { postMessage: (message: any) => messages.push(message) } }, registerProcessor: (_name: string, ctor: any) => { Processor = ctor } }
  vm.runInNewContext(readFileSync('public/audio-worklets/onset-detector-processor.js', 'utf8'), sandbox)
  const processor = new Processor()
  processor.port.onmessage({ data: { type: 'config', config: { minOnsetEnergy: .001, adaptiveThresholdOffset: .00025 } } })
  const expected = [1, 1.5, 2, 2.5]
  for (let sample = 0; sample < 3 * 48000; sample += 128) {
    sandbox.currentTime = sample / 48000
    const pcm = Float32Array.from({ length: 128 }, (_, i) => {
      const t = (sample + i) / 48000
      const since = t - (expected.filter(time => time <= t).at(-1) ?? -10)
      return .00005 * Math.sin(2 * Math.PI * 80 * t) + (since < .025 ? .04 * Math.exp(-since * 150) * Math.sin(2 * Math.PI * 1000 * t) : 0)
    })
    processor.process([[pcm]], [], {})
  }
  const result = evaluateRhythm(expected, messages.filter(message => message.type === 'onset').map(message => message.timestamp))
  expect(result).toMatchObject({ detected: 4, matched: 4, f1: 100 })
})
