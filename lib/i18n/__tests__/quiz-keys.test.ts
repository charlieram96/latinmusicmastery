// lib/i18n/__tests__/quiz-keys.test.ts
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en.json'
import es from '@/locales/es.json'

// Every quiz translation key referenced in the student quiz components must
// resolve to a string in BOTH dictionaries. This is the class of bug behind the
// "Try again" button once rendering its own key path.
const ROOTS = ['components/class-viewer/lesson-viewer/quiz', 'components/class-viewer/lesson-viewer/quiz-runner.tsx']
const KEY_RE = /'(dashboard\.classViewer\.quiz\.[A-Za-z0-9_.]+)'/g

function files(path: string): string[] {
  const full = join(process.cwd(), path)
  if (statSync(full).isFile()) return [full]
  return readdirSync(full).flatMap((f) => files(join(path, f)))
}
function resolve(dict: unknown, key: string): unknown {
  return key.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), dict)
}

describe('quiz translation keys', () => {
  const keys = new Set<string>()
  for (const f of ROOTS.flatMap(files)) {
    if (!/\.(tsx?|css)$/.test(f)) continue
    const src = readFileSync(f, 'utf8')
    for (const m of src.matchAll(KEY_RE)) keys.add(m[1])
  }
  it('finds keys to check', () => {
    expect(keys.size).toBeGreaterThan(30)
  })
  it.each([...keys].sort())('%s resolves in en and es', (key) => {
    expect(typeof resolve(en, key), `en:${key}`).toBe('string')
    expect(typeof resolve(es, key), `es:${key}`).toBe('string')
  })
})
