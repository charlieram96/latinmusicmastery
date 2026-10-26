import { describe, expect, it } from 'vitest'
import jsQR from 'jsqr'
import { PDFDocument, StandardFonts } from 'pdf-lib'
import { code128Bars, qrMatrix, qrSvg } from '../symbols'
import { renderTicketsPdf, ticketUrl, wrapText } from '../pdf'
import { loadDefaultLogo, loadTicketFonts } from '../assets'
import { normalizeTicketDesign } from '../design'

function decodeMatrix(text: string): string | null {
  const { size, dark } = qrMatrix(text)
  const scale = 6
  const quiet = 4
  const px = (size + quiet * 2) * scale
  const data = new Uint8ClampedArray(px * px * 4).fill(255)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!dark[y * size + x]) continue
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const i = (((y + quiet) * scale + dy) * px + (x + quiet) * scale + dx) * 4
          data[i] = data[i + 1] = data[i + 2] = 0
        }
      }
    }
  }
  return jsQR(data, px, px)?.data ?? null
}

describe('symbols', () => {
  it('encodes QR codes that decode back to the ticket URL', () => {
    const url = ticketUrl('https://latinmusicmastery.com/', 'AbCdEfGhIjKlMnOpQrStUv')
    expect(url).toBe('https://latinmusicmastery.com/t/AbCdEfGhIjKlMnOpQrStUv')
    expect(decodeMatrix(url)).toBe(url)
  })

  it('encodes Code 128 with start, data, check and stop symbols', () => {
    const { modules, bars } = code128Bars('LMM-7K3Q-9XW2')
    // 11 modules per symbol (start + 13 chars + check) and a 13-module stop.
    expect(modules).toBe(11 * 15 + 13)
    expect(bars[0]).toEqual([0, 2])
  })

  it('renders a standalone QR SVG', () => {
    const svg = qrSvg('https://example.com/t/x', { title: 'Ticket <1>' })
    expect(svg).toMatch(/^<svg /)
    expect(svg).toContain('<title>Ticket &lt;1&gt;</title>')
  })
})

describe('renderTicketsPdf', () => {
  const event = {
    title: 'Noche de Salsa', subtitle: 'Live', venueName: 'The Fillmore', venueAddress: '1700 Washington Ave',
    startsAt: '2026-11-22T01:00:00Z', doorsAt: '2026-11-22T00:00:00Z', timezone: 'America/New_York', currency: 'usd',
  }
  const tickets = [
    { ticketNumber: 'LMM-7K3Q-9XW2', code: 'AbCdEfGhIjKlMnOpQrStUv', tierName: 'VIP', priceCents: 6000, comp: false, attendeeName: 'María José', orderRef: 'ABCD1234' },
    { ticketNumber: 'LMM-0P4R-ZT8M', code: 'ZyXwVuTsRqPoNmLkJiHgFe', tierName: 'General', priceCents: 0, comp: true, attendeeName: null, orderRef: null },
  ]

  for (const layout of ['stub', 'pass'] as const) {
    it(`renders one ${layout} page per ticket in both languages`, async () => {
      for (const locale of ['en', 'es'] as const) {
        const bytes = await renderTicketsPdf({
          design: normalizeTicketDesign({ layout, show: { barcode: layout === 'stub' } }),
          event, tickets, locale, appUrl: 'https://latinmusicmastery.com',
          fonts: await loadTicketFonts(), logo: await loadDefaultLogo(), image: null,
        })
        const doc = await PDFDocument.load(bytes)
        expect(doc.getPageCount()).toBe(2)
        expect(doc.getTitle()).toBe('Noche de Salsa')
        const { width, height } = doc.getPage(0).getSize()
        expect(layout === 'stub' ? width > height : height > width).toBe(true)
      }
    })
  }

  it('ignores unreadable images instead of failing', async () => {
    const bytes = await renderTicketsPdf({
      design: normalizeTicketDesign({}), event, tickets: tickets.slice(0, 1), locale: 'en', appUrl: 'https://x.test',
      fonts: await loadTicketFonts(), logo: new Uint8Array([0x89, 0x50, 1, 2, 3, 4, 5, 6, 7]), image: new Uint8Array([1, 2, 3]),
    })
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1)
  })
})

describe('wrapText', () => {
  it('wraps, limits lines and adds an ellipsis', async () => {
    const font = await (await PDFDocument.create()).embedFont(StandardFonts.Helvetica)
    const text = 'one two three four five six seven eight nine ten'
    const lines = wrapText(text, font, 10, 60, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('…')).toBe(true)
    expect(wrapText('short', font, 10, 200, 2)).toEqual(['short'])
  })
})
