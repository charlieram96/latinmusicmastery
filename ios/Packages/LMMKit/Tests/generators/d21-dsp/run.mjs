// Executes the REAL production worklet (public/audio-worklets/onset-detector-processor.js)
// offline in Node, feeding it deterministic 128-sample blocks, and records the emitted
// port messages as a Swift-consumable golden JSON.
//
// The worklet is a plain AudioWorkletProcessor subclass that reads only two browser
// globals (`sampleRate`, `currentTime`) and posts to `this.port`. We stub the base class
// + `registerProcessor` in a `vm` context and mutate `currentTime` per block. No
// OfflineAudioContext needed — verified self-contained by reading the file (no DOM /
// fetch / timers / other globals).

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import vm from 'node:vm'
import { buildSignal, checksum } from './signal.mjs'
import { CONFIGS, FIXTURES } from './configs.mjs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(__dirname, '../../../../..') // scratchpad/<uuid>/... -> repo? resolved below
const WORKLET = path.resolve(
  '/Users/charlieramirez/Desktop/latinmusicmastery/public/audio-worklets/onset-detector-processor.js'
)
const OUT = path.resolve(
  '/Users/charlieramirez/Desktop/latinmusicmastery/ios/Packages/LMMKit/Tests/PlaySenseAudioTests/Fixtures/onset_dsp.json'
)

const SR = 48000
const BLOCK = 128

function makeProcessor(workletSource) {
  const messages = []
  const sandbox = {
    sampleRate: SR,
    currentTime: 0,
    registeredClass: null,
    __messages: messages,
    console,
    Math,
    Float32Array,
    Array,
    Infinity,
    isFinite,
  }
  sandbox.AudioWorkletProcessor = class {
    constructor() {
      this.port = {
        postMessage: (m) => sandbox.__messages.push({ t: sandbox.currentTime, ...m }),
        onmessage: null,
      }
    }
  }
  sandbox.registerProcessor = (_name, cls) => {
    sandbox.registeredClass = cls
  }
  const context = vm.createContext(sandbox)
  vm.runInContext(workletSource, context, { filename: 'onset-detector-processor.js' })
  return { sandbox, context, messages }
}

function runFixture(workletSource, fixture) {
  const { sandbox, messages } = makeProcessor(workletSource)
  const Proc = sandbox.registeredClass
  const proc = new Proc()

  const config = CONFIGS[fixture.config]
  // Send a config message (exercises the reset/realloc path), exactly like production.
  proc.port.onmessage({ data: { type: 'config', config } })

  // Build + pad signal to a whole number of 128-blocks (Web Audio always delivers 128).
  const raw = buildSignal(SR, fixture.signal)
  const nBlocks = Math.ceil(raw.length / BLOCK)
  const padded = new Float32Array(nBlocks * BLOCK)
  padded.set(raw)

  for (let b = 0; b < nBlocks; b++) {
    sandbox.currentTime = (b * BLOCK) / SR
    const block = padded.subarray(b * BLOCK, b * BLOCK + BLOCK)
    proc.process([[block]], [[new Float32Array(BLOCK)]], {})
  }

  const onsets = messages.filter((m) => m.type === 'onset').map((m) => ({
    timestamp: m.timestamp,
    energy: m.energy,
    fluxConfirmed: m.fluxConfirmed,
    frequency: m.frequency,
  }))
  const chords = messages.filter((m) => m.type === 'chord').map((m) => ({
    onsetTimestamp: m.onsetTimestamp,
    chroma: Array.from(m.chroma),
  }))
  const levels = messages.filter((m) => m.type === 'level')
  const levelStats = {
    count: levels.length,
    max: levels.reduce((mx, m) => Math.max(mx, m.level), 0),
    last: levels.length ? levels[levels.length - 1].level : 0,
  }

  return {
    name: fixture.name,
    configName: fixture.config,
    config,
    signal: fixture.signal,
    sampleRate: SR,
    blockSize: BLOCK,
    paddedLength: padded.length,
    inputChecksum: checksum(padded),
    onsets,
    chords,
    levelStats,
  }
}

const workletSource = readFileSync(WORKLET, 'utf8')
const fixtures = FIXTURES.map((f) => runFixture(workletSource, f))
const golden = {
  generator: 'scratchpad/d21-gen/run.mjs',
  worklet: 'public/audio-worklets/onset-detector-processor.js',
  sampleRate: SR,
  blockSize: BLOCK,
  fixtures,
}
writeFileSync(OUT, JSON.stringify(golden, null, 2))

// Console summary for the task report.
for (const f of fixtures) {
  console.log(
    `${f.name.padEnd(24)} cfg=${f.configName.padEnd(11)} onsets=${f.onsets.length} chords=${f.chords.length} ` +
      `levels=${f.levelStats.count} maxLvl=${f.levelStats.max.toFixed(4)}`
  )
  for (const o of f.onsets) {
    console.log(
      `   onset t=${o.timestamp.toFixed(5)} e=${o.energy.toFixed(6)} flux=${o.fluxConfirmed} ` +
        `f=${o.frequency == null ? 'null' : o.frequency.toFixed(2)}`
    )
  }
  for (const c of f.chords) {
    console.log(`   chord @${c.onsetTimestamp.toFixed(5)} chroma=[${c.chroma.map((x) => x.toFixed(2)).join(',')}]`)
  }
}
console.log(`\nWrote ${OUT}`)
