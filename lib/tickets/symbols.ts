// QR and Code 128 encodings for tickets, from bwip-js (server only). The PDF
// renderer and the web ticket pages draw these as vector shapes, so they stay
// crisp at any zoom and print size.

import bwipjs from 'bwip-js'

export interface QrMatrix {
  /** Modules per side (without quiet zone). */
  size: number
  /** Row-major, top row first; true = dark module. */
  dark: boolean[]
}

export function qrMatrix(text: string): QrMatrix {
  const [symbol] = bwipjs.raw('qrcode', text, { eclevel: 'M' }) as Array<{
    pixs: number[]
    pixx: number
    pixy: number
  }>
  if (!symbol || symbol.pixx !== symbol.pixy) throw new Error('QR encoding failed')
  return { size: symbol.pixx, dark: symbol.pixs.map((v) => v === 1) }
}

export interface LinearBars {
  /** Total width in modules (without quiet zone). */
  modules: number
  /** Dark bars as [startModule, widthModules]. */
  bars: Array<[number, number]>
}

export function code128Bars(text: string): LinearBars {
  const [symbol] = bwipjs.raw('code128', text, {}) as Array<{ sbs: number[] }>
  if (!symbol?.sbs?.length) throw new Error('Code 128 encoding failed')
  // sbs alternates bar, space, bar, ... starting with a bar.
  const bars: Array<[number, number]> = []
  let x = 0
  symbol.sbs.forEach((width, i) => {
    if (i % 2 === 0) bars.push([x, width])
    x += width
  })
  return { modules: x, bars }
}

/** Standalone SVG of a QR code (dark on white, 4-module quiet zone). */
export function qrSvg(text: string, { title }: { title?: string } = {}): string {
  const { size, dark } = qrMatrix(text)
  const quiet = 4
  const full = size + quiet * 2
  let d = ''
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (dark[y * size + x]) d += `M${x + quiet} ${y + quiet}h1v1h-1z`
    }
  }
  const label = title ? `<title>${escapeXml(title)}</title>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" shape-rendering="crispEdges" role="img">${label}<rect width="${full}" height="${full}" fill="#fff"/><path d="${d}" fill="#111"/></svg>`
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
