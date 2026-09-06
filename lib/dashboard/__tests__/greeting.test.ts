import { describe, expect, it } from 'vitest'
import { greetingKey } from '../greeting'

describe('greetingKey', () => {
  it('says morning from 5:00 to 11:59', () => {
    expect(greetingKey(5)).toBe('morning')
    expect(greetingKey(11)).toBe('morning')
  })
  it('says afternoon from 12:00 to 17:59', () => {
    expect(greetingKey(12)).toBe('afternoon')
    expect(greetingKey(17)).toBe('afternoon')
  })
  it('says evening otherwise, including the small hours', () => {
    expect(greetingKey(18)).toBe('evening')
    expect(greetingKey(23)).toBe('evening')
    expect(greetingKey(0)).toBe('evening')
    expect(greetingKey(4)).toBe('evening')
  })
})
