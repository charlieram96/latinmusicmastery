import { describe, expect, it } from 'vitest'
import en from '@/locales/en.json'
import es from '@/locales/es.json'

type Tree = { [k: string]: string | Tree }

function leaves(tree: Tree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(tree)) {
    if (k === '_') continue // area sentinel, see locales marketing.site.*
    const key = prefix ? `${prefix}.${k}` : k
    if (typeof v === 'string') out[key] = v
    else Object.assign(out, leaves(v, key))
  }
  return out
}

const site = (l: unknown) => leaves(((l as { marketing: { site: Tree } }).marketing.site))

describe('marketing.site locale keys', () => {
  const E = site(en), S = site(es)
  it('has the same keys in English and Spanish', () => {
    expect(Object.keys(S).sort()).toEqual(Object.keys(E).sort())
  })
  it('has no empty strings', () => {
    for (const [k, v] of [...Object.entries(E), ...Object.entries(S)]) expect(v.trim(), k).not.toBe('')
  })
  it('keeps {placeholders} identical across languages', () => {
    const ph = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join(',')
    for (const k of Object.keys(E)) expect(ph(S[k] ?? ''), k).toBe(ph(E[k]))
  })
})
