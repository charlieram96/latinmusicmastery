import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const between = (s: string) => s.split('// @mpm-begin')[1].split('// @mpm-end')[0]
const norm = (s: string) => s.replace(/: any/g, '').replace(/\s+/g, ' ').trim()

describe('worklet sync', () => {
  it('the worklet copy of mpm equals the lib version', () => {
    const lib = readFileSync(path.resolve(__dirname, '../pitch-engine.ts'), 'utf8')
    const wk = readFileSync(
      path.resolve(__dirname, '../../../public/audio-worklets/pitch-detector-processor.js'),
      'utf8'
    )
    expect(norm(between(wk))).toBe(norm(between(lib)))
  })

  it('the worklet registers the processor name the hook expects', () => {
    const wk = readFileSync(
      path.resolve(__dirname, '../../../public/audio-worklets/pitch-detector-processor.js'),
      'utf8'
    )
    expect(wk).toContain("registerProcessor('pitch-detector-processor'")
  })
})
