import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { BioProse, hasText } from '../BioProse'

const html = (doc: unknown) => renderToStaticMarkup(<BioProse doc={doc} />)
const text = (t: string, marks?: unknown[]) => ({ type: 'text', text: t, ...(marks ? { marks } : {}) })

describe('BioProse', () => {
  it('renders nothing for empty or invalid docs', () => {
    expect(html(null)).toBe('')
    expect(html('nope')).toBe('')
    expect(html({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe('')
  })
  it('demotes headings one level below the page title', () => {
    const out = html({ type: 'doc', content: [
      { type: 'heading', attrs: { level: 1 }, content: [text('Name')] },
      { type: 'heading', attrs: { level: 2 }, content: [text('Tagline')] },
      { type: 'heading', attrs: { level: 3 }, content: [text('Role')] },
    ] })
    expect(out).toContain('<h2>Name</h2>')
    expect(out).toContain('<h3>Tagline</h3>')
    expect(out).toContain('<h4>Role</h4>')
  })
  it('renders paragraphs, lists, breaks, rules and marks', () => {
    const out = html({ type: 'doc', content: [
      { type: 'paragraph', content: [text('Bold', [{ type: 'bold' }]), { type: 'hardBreak' }, text('it', [{ type: 'italic' }])] },
      { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('one')] }] }] },
      { type: 'orderedList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [text('two')] }] }] },
      { type: 'horizontalRule' },
    ] })
    expect(out).toContain('<p><strong>Bold</strong><br/><em>it</em></p>')
    expect(out).toContain('<ul><li><p>one</p></li></ul>')
    expect(out).toContain('<ol><li><p>two</p></li></ol>')
    expect(out).toContain('<hr/>')
  })
  it('keeps safe links and drops unsafe ones', () => {
    const out = html({ type: 'doc', content: [{ type: 'paragraph', content: [
      text('site', [{ type: 'link', attrs: { href: 'https://example.com' } }]),
      text(' bad', [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }]),
    ] }] })
    expect(out).toContain('<a href="https://example.com" target="_blank" rel="noopener noreferrer nofollow">site</a>')
    expect(out).not.toContain('javascript:')
    expect(out).toContain(' bad')
  })
  it('skips empty paragraphs', () => {
    expect(html({ type: 'doc', content: [{ type: 'paragraph', content: [text('a')] }, { type: 'paragraph' }] })).toBe('<p>a</p>')
  })
})

describe('reflowParagraphs', () => {
  const para = (t: string) => ({ type: 'paragraph', content: [text(t)] })
  const long = 'Patricio was born in Camagüey City, a province of Cuba, on May the 27th, 1974. He started his'
  it('rejoins line-length paragraphs that stop mid-sentence', () => {
    const out = html({ type: 'doc', content: [para(long), para('elementary studies of music.'), para('Next paragraph.')] })
    expect(out).toBe(`<p>${long} elementary studies of music.</p><p>Next paragraph.</p>`)
  })
  it('leaves short lines, finished sentences and headings alone', () => {
    const out = html({ type: 'doc', content: [para('PATRICIO DÍAZ NÁPOLES'), para(long + ' studies.'), para('Another one.'), { type: 'heading', attrs: { level: 2 }, content: [text('H')] }] })
    expect(out).toBe(`<p>PATRICIO DÍAZ NÁPOLES</p><p>${long} studies.</p><p>Another one.</p><h3>H</h3>`)
  })
})

describe('hasText', () => {
  it('is false for an editor-cleared doc and malformed input', () => {
    expect(hasText({ type: 'doc', content: [{ type: 'paragraph' }] })).toBe(false)
    expect(hasText(null)).toBe(false)
  })
  it('ignores non-string text instead of crashing', () => {
    expect(html({ type: 'doc', content: [{ type: 'paragraph', content: [text('ok'), { type: 'text', text: { bad: 1 } }] }] })).toBe('<p>ok</p>')
  })
})
