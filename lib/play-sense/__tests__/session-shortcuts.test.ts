import { describe, expect, it } from 'vitest'
import { sessionShortcut } from '../session-shortcuts'

const key = (k: string, target: Partial<Element> | null = null) => ({ key: k, target } as unknown as KeyboardEvent)
const editable = { closest: (sel: string) => (sel.includes('input') ? {} : null) } as unknown as Element

describe('sessionShortcut', () => {
  it('maps Space to pause while playing and to resume while paused', () => {
    expect(sessionShortcut(key(' '), 'playing')).toBe('pause')
    expect(sessionShortcut(key(' '), 'paused')).toBe('resume')
    expect(sessionShortcut(key(' '), 'countdown')).toBeNull()
    expect(sessionShortcut(key(' '), 'selecting')).toBeNull()
  })
  it('maps R to restart during a count-in, while playing, and while paused', () => {
    expect(sessionShortcut(key('r'), 'countdown')).toBe('restart')
    expect(sessionShortcut(key('R'), 'playing')).toBe('restart')
    expect(sessionShortcut(key('r'), 'paused')).toBe('restart')
    expect(sessionShortcut(key('r'), 'results')).toBeNull()
  })
  it('ignores keys typed into controls and other keys', () => {
    expect(sessionShortcut(key(' ', editable), 'playing')).toBeNull()
    expect(sessionShortcut(key('p'), 'playing')).toBeNull()
  })
})
