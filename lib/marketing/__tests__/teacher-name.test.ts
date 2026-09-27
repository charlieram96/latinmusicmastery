import { describe, expect, it } from 'vitest'
import { splitNickname } from '../teacher-name'

describe('splitNickname', () => {
  it('pulls a straight-quoted nickname out and title-cases it', () => {
    expect(splitNickname('Patricio "el chino" Diaz')).toEqual({ before: 'Patricio', nickname: 'El Chino', after: 'Diaz' })
  })
  it('handles curly quotes', () => {
    expect(splitNickname('Patricio “El Chino” Díaz')).toEqual({ before: 'Patricio', nickname: 'El Chino', after: 'Díaz' })
  })
  it('returns the whole name when there is no nickname', () => {
    expect(splitNickname('Frank La Rosa')).toEqual({ before: 'Frank La Rosa', nickname: null, after: '' })
  })
  it('ignores an unmatched quote', () => {
    expect(splitNickname('O"Brien Smith')).toEqual({ before: 'O"Brien Smith', nickname: null, after: '' })
  })
})
