import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en.json'
import es from '@/locales/es.json'

// Every exercise translation key the student surfaces reference must resolve
// to a string in BOTH dictionaries, or the button renders its own key path.
const FILES = [
  'components/class-viewer/lesson-viewer/exercise-view.tsx',
  'components/class-viewer/lesson-viewer/exercise-mode-frame.tsx',
  'components/class-viewer/lesson-viewer/score-exercise-game.tsx',
  'components/play-sense/performance-results.tsx',
]
const KEY_RE = /'(dashboard\.classViewer\.exercise\.[A-Za-z0-9_.]+)'/g

function resolve(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), dict)
}

describe('exercise translation keys', () => {
  const keys = new Set<string>()
  for (const file of FILES) {
    for (const match of readFileSync(join(process.cwd(), file), 'utf8').matchAll(KEY_RE)) keys.add(match[1])
  }
  it('finds the keys the components use', () => {
    expect(keys.size).toBeGreaterThan(3)
  })
  for (const key of keys) {
    it(`${key} exists in English and Spanish`, () => {
      expect(typeof resolve(en, key)).toBe('string')
      expect(typeof resolve(es, key)).toBe('string')
    })
  }
})
