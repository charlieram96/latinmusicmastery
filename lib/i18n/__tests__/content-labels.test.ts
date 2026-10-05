import { expect, it } from 'vitest'
import { stripLanguageLabels, stripRichLanguageLabels } from '../content-labels'

it('removes line prefixes while preserving language mentions in prose', () => {
  expect(stripLanguageLabels('English: Learn the timbal.\nEspañol: Aprende el timbal.')).toBe('Learn the timbal.\nAprende el timbal.')
  expect(stripLanguageLabels('English music and Spanish music.')).toBe('English music and Spanish music.')
})

it('removes split formatted prefixes without mutating notes or losing marks', () => {
  const original = { type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'English', marks: [{ type: 'bold' }] },
    { type: 'text', text: ': Learn', marks: [{ type: 'italic' }] },
  ] }] }
  expect(stripRichLanguageLabels(original)).toEqual({ type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'text', text: 'Learn', marks: [{ type: 'italic' }] },
  ] }] })
  expect(original.content[0].content[0].text).toBe('English')
})
