import { describe, expect, it } from 'vitest'
import { localizedRichContent, withRichContentTranslation } from '../rich-content'

const en = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'English notes' }] }] }
const es = { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Notas en español' }] }] }

describe('rich content language variants', () => {
  it('selects Spanish while retaining the original English document', () => {
    const saved = withRichContentTranslation(en, 'es', es)
    expect(localizedRichContent(saved, 'es')).toEqual(es)
    expect(localizedRichContent(saved, 'en')?.content).toEqual(en.content)
    expect(en).not.toHaveProperty('translations')
  })
  it('preserves Spanish notes after editing English', () => {
    const saved = withRichContentTranslation(en, 'es', es)
    const edited = withRichContentTranslation(saved, 'en', { ...en, content: [] })
    expect(localizedRichContent(edited, 'es')).toEqual(es)
    expect(localizedRichContent(edited, 'en')?.content).toEqual([])
  })
  it('does not silently substitute English when Spanish notes are missing', () => {
    expect(localizedRichContent(en, 'es')).toBeNull()
    expect(localizedRichContent(null, 'en')).toBeNull()
  })
})
