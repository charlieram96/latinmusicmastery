// Ticket PDF renderer: one page per admission, drawn from the event's ticket
// design. Pure (all fonts and images arrive as bytes) so tests and the admin
// live preview run the exact code that produces the emailed tickets.

import {
  PDFDocument,
  type PDFFont,
  type PDFImage,
  type PDFPage,
  type RGB,
  appendBezierCurve,
  clip,
  closePath,
  endPath,
  lineTo,
  moveTo,
  popGraphicsState,
  pushGraphicsState,
  rectangle,
  rgb,
  setCharacterSpacing,
} from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import { getTranslation, type Locale } from '@/lib/i18n'
import { type TicketDesign, inkOn } from './design'
import { code128Bars, qrMatrix } from './symbols'
import { formatEventDate, formatEventTime, formatMoney } from './format'

export interface TicketFontFiles {
  displayBlack: Uint8Array
  displayBold: Uint8Array
  body: Uint8Array
  bodySemibold: Uint8Array
  mono: Uint8Array
  serif: Uint8Array
}

export interface TicketPdfEvent {
  title: string
  subtitle: string | null
  venueName: string | null
  venueAddress: string | null
  startsAt: string
  doorsAt: string | null
  timezone: string
  currency: string
}

export interface TicketPdfTicket {
  ticketNumber: string
  /** Secret QR code (the QR encodes `${appUrl}/t/${code}`). */
  code: string
  tierName: string
  priceCents: number
  comp: boolean
  attendeeName: string | null
  orderRef: string | null
}

export interface TicketPdfInput {
  design: TicketDesign
  event: TicketPdfEvent
  tickets: TicketPdfTicket[]
  locale: Locale
  appUrl: string
  fonts: TicketFontFiles
  /** Logo bytes (PNG/JPEG), already chosen from the design; null = no logo. */
  logo: Uint8Array | null
  /** Artwork bytes (PNG/JPEG); null = no artwork. */
  image: Uint8Array | null
}

export function ticketUrl(appUrl: string, code: string): string {
  return `${appUrl.replace(/\/$/, '')}/t/${code}`
}

export async function renderTicketsPdf(input: TicketPdfInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(input.event.title)
  doc.setAuthor('Latin Music Mastery')
  doc.setCreator('Latin Music Mastery Tickets')
  doc.setProducer('Latin Music Mastery')

  const fonts: Fonts = {
    displayBlack: await doc.embedFont(input.fonts.displayBlack, { subset: true }),
    displayBold: await doc.embedFont(input.fonts.displayBold, { subset: true }),
    body: await doc.embedFont(input.fonts.body, { subset: true }),
    bodySemibold: await doc.embedFont(input.fonts.bodySemibold, { subset: true }),
    mono: await doc.embedFont(input.fonts.mono, { subset: true }),
    serif: await doc.embedFont(input.fonts.serif, { subset: true }),
  }
  const logo = await embedImage(doc, input.logo)
  const image = await embedImage(doc, input.image)
  const t = (key: string, params?: Record<string, string | number>) =>
    getTranslation(input.locale, `tickets.pdf.${key}`, params)

  for (const ticket of input.tickets) {
    const draw = input.design.layout === 'pass' ? drawPass : drawStub
    draw({ doc, input, fonts, logo, image, ticket, t })
  }
  return doc.save()
}

// ──────────────────────────────────────────────────────────────────────────
// Shared drawing helpers (all y values are measured from the top of the page)
// ──────────────────────────────────────────────────────────────────────────

interface Fonts {
  displayBlack: PDFFont
  displayBold: PDFFont
  body: PDFFont
  bodySemibold: PDFFont
  mono: PDFFont
  serif: PDFFont
}

interface DrawArgs {
  doc: PDFDocument
  input: TicketPdfInput
  fonts: Fonts
  logo: PDFImage | null
  image: PDFImage | null
  ticket: TicketPdfTicket
  t: (key: string, params?: Record<string, string | number>) => string
}

interface Canvas {
  page: PDFPage
  H: number
}

function color(hex: string): RGB {
  return rgb(parseInt(hex.slice(1, 3), 16) / 255, parseInt(hex.slice(3, 5), 16) / 255, parseInt(hex.slice(5, 7), 16) / 255)
}

function mix(a: string, b: string, k: number): RGB {
  const ca = color(a), cb = color(b)
  return rgb(ca.red + (cb.red - ca.red) * k, ca.green + (cb.green - ca.green) * k, ca.blue + (cb.blue - ca.blue) * k)
}

async function embedImage(doc: PDFDocument, bytes: Uint8Array | null): Promise<PDFImage | null> {
  if (!bytes || bytes.length < 8) return null
  try {
    if (bytes[0] === 0x89 && bytes[1] === 0x50) return await doc.embedPng(bytes)
    if (bytes[0] === 0xff && bytes[1] === 0xd8) return await doc.embedJpg(bytes)
  } catch {
    // A corrupt upload should not stop tickets from being issued.
  }
  return null
}

function fillRect(c: Canvas, x: number, y: number, w: number, h: number, fill: RGB, opacity = 1) {
  c.page.drawRectangle({ x, y: c.H - y - h, width: w, height: h, color: fill, opacity })
}

function gradientRect(c: Canvas, x: number, y: number, w: number, h: number, from: string, to: string, horizontal: boolean) {
  const steps = 64
  for (let i = 0; i < steps; i++) {
    const k = i / (steps - 1)
    if (horizontal) fillRect(c, x + (w * i) / steps, y, w / steps + 0.6, h, mix(from, to, k))
    else fillRect(c, x, y + (h * i) / steps, w, h / steps + 0.6, mix(from, to, k))
  }
}

/**
 * Fade toward `hex`: 'right'/'down' end fully covered, 'up' is densest at the
 * top edge. Strips are stacked (each runs to the dense edge) with alphas chosen
 * so the composite follows the curve; abutting translucent strips would seam.
 */
function fadeRect(c: Canvas, x: number, y: number, w: number, h: number, hex: string, dir: 'right' | 'down' | 'up', maxAlpha = 1) {
  const steps = 40
  const len = dir === 'right' ? w : h
  const fill = color(hex)
  let prev = 0
  for (let i = 0; i < steps; i++) {
    const target = maxAlpha * ((i + 1) / steps) ** 2
    const alpha = 1 - (1 - target) / (1 - prev)
    prev = target
    const off = (len * i) / steps
    if (dir === 'right') fillRect(c, x + off, y, w - off, h, fill, alpha)
    else if (dir === 'down') fillRect(c, x, y + off, w, h - off, fill, alpha)
    else fillRect(c, x, y, w, h - off, fill, alpha)
  }
}

/** Draw an image scaled to cover the box, clipped to it. */
function imageCover(c: Canvas, img: PDFImage, x: number, y: number, w: number, h: number, opacity: number) {
  const scale = Math.max(w / img.width, h / img.height)
  const dw = img.width * scale
  const dh = img.height * scale
  c.page.pushOperators(pushGraphicsState(), rectangle(x, c.H - y - h, w, h), clip(), endPath())
  c.page.drawImage(img, { x: x + (w - dw) / 2, y: c.H - y - h + (h - dh) / 2, width: dw, height: dh, opacity })
  c.page.pushOperators(popGraphicsState())
}

/** Draw an image scaled to fit within the box (anchored top-left). Returns drawn size. */
function imageContain(c: Canvas, img: PDFImage, x: number, y: number, maxW: number, maxH: number, align: 'left' | 'center' = 'left') {
  const scale = Math.min(maxW / img.width, maxH / img.height)
  const w = img.width * scale
  const h = img.height * scale
  const dx = align === 'center' ? (maxW - w) / 2 : 0
  c.page.drawImage(img, { x: x + dx, y: c.H - y - h, width: w, height: h })
  return { w, h }
}

interface TextOpts {
  font: PDFFont
  size: number
  fill: RGB
  spacing?: number
  align?: 'left' | 'center' | 'right'
  width?: number
  opacity?: number
}

function textWidth(s: string, font: PDFFont, size: number, spacing = 0): number {
  return font.widthOfTextAtSize(s, size) + spacing * Math.max(0, [...s].length - 1)
}

/** Draw one line with its baseline at `baseline` (from top). */
function drawLine(c: Canvas, s: string, x: number, baseline: number, o: TextOpts) {
  if (!s) return
  const w = textWidth(s, o.font, o.size, o.spacing)
  const dx = o.align === 'center' && o.width ? (o.width - w) / 2 : o.align === 'right' && o.width ? o.width - w : 0
  if (o.spacing) c.page.pushOperators(pushGraphicsState(), setCharacterSpacing(o.spacing))
  c.page.drawText(s, { x: x + dx, y: c.H - baseline, font: o.font, size: o.size, color: o.fill, opacity: o.opacity })
  if (o.spacing) c.page.pushOperators(popGraphicsState())
}

function clean(s: string | null | undefined): string {
  return (s ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Greedy word wrap with no line limit (a single long word may overflow). */
function wrapWords(s: string, font: PDFFont, size: number, maxWidth: number, spacing = 0): string[] {
  const lines: string[] = []
  let line = ''
  for (const word of clean(s).split(' ').filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (!line || textWidth(next, font, size, spacing) <= maxWidth) line = next
    else { lines.push(line); line = word }
  }
  if (line) lines.push(line)
  return lines
}

/** Word wrap limited to `maxLines`, ending with an ellipsis when cut. */
export function wrapText(s: string, font: PDFFont, size: number, maxWidth: number, maxLines: number, spacing = 0): string[] {
  const all = wrapWords(s, font, size, maxWidth, spacing)
  const lines = all.slice(0, maxLines)
  const cut = all.length > maxLines || lines.some((l) => textWidth(l, font, size, spacing) > maxWidth)
  if (cut && lines.length) {
    let last = all.length > maxLines ? `${lines[lines.length - 1]} ${all[maxLines]}` : lines[lines.length - 1]
    while (last && textWidth(`${last}…`, font, size, spacing) > maxWidth) last = last.slice(0, -1).trimEnd()
    lines[lines.length - 1] = `${last}…`
  }
  return lines
}

function fitsIn(lines: string[], font: PDFFont, size: number, maxWidth: number, maxLines: number) {
  return lines.length <= maxLines && lines.every((l) => textWidth(l, font, size) <= maxWidth)
}

/** Same line count, narrowest width: evens out line lengths (no orphans). */
function balanceLines(s: string, font: PDFFont, size: number, maxWidth: number, lines: string[]): string[] {
  if (lines.length < 2) return lines
  let lo = maxWidth / lines.length
  let hi = maxWidth
  let best = lines
  for (let i = 0; i < 14; i++) {
    const mid = (lo + hi) / 2
    const attempt = wrapWords(s, font, size, mid)
    if (fitsIn(attempt, font, size, mid, lines.length)) { best = attempt; hi = mid } else lo = mid
  }
  return best
}

/** Largest size (stepping down) whose balanced lines fit both width and height. */
function fitText(s: string, font: PDFFont, maxWidth: number, maxHeight: number, maxLines: number, maxSize: number, minSize: number, leading: number) {
  for (let size = maxSize; size >= minSize; size -= 1) {
    const lines = wrapWords(s, font, size, maxWidth)
    if (fitsIn(lines, font, size, maxWidth, maxLines) && lines.length * size * leading <= maxHeight) {
      return { size, lines: balanceLines(s, font, size, maxWidth, lines) }
    }
  }
  const lines = wrapText(s, font, minSize, maxWidth, maxLines)
  return { size: minSize, lines: lines.some((l) => l.endsWith('…')) ? lines : balanceLines(s, font, minSize, maxWidth, lines) }
}

/**
 * Backdrop-coloured mask around the ticket silhouette: rounded corners plus
 * two semicircular notches at the perforation. Drawn last over everything.
 */
function silhouetteMask(c: Canvas, W: number, box: { x0: number; y0: number; x1: number; y1: number }, r: number, notch: { axis: 'x' | 'y'; at: number; radius: number }, backdrop: RGB) {
  const { x0, y0, x1, y1 } = box
  const n = notch.radius
  const H = c.H
  let d = `M0 0H${W}V${H}H0Z`
  // Inner silhouette, counter-clockwise on screen so non-zero fill leaves a hole.
  d += `M${x0} ${y0 + r}`
  d += notch.axis === 'y' ? `V${notch.at - n}A${n} ${n} 0 0 1 ${x0} ${notch.at + n}V${y1 - r}` : `V${y1 - r}`
  d += `A${r} ${r} 0 0 0 ${x0 + r} ${y1}`
  d += notch.axis === 'x' ? `H${notch.at - n}A${n} ${n} 0 0 1 ${notch.at + n} ${y1}H${x1 - r}` : `H${x1 - r}`
  d += `A${r} ${r} 0 0 0 ${x1} ${y1 - r}`
  d += notch.axis === 'y' ? `V${notch.at + n}A${n} ${n} 0 0 1 ${x1} ${notch.at - n}V${y0 + r}` : `V${y0 + r}`
  d += `A${r} ${r} 0 0 0 ${x1 - r} ${y0}`
  d += notch.axis === 'x' ? `H${notch.at + n}A${n} ${n} 0 0 1 ${notch.at - n} ${y0}H${x0 + r}` : `H${x0 + r}`
  d += `A${r} ${r} 0 0 0 ${x0} ${y0 + r}Z`
  c.page.drawSvgPath(d, { x: 0, y: H, color: backdrop })
}

function perforation(c: Canvas, x1: number, y1: number, x2: number, y2: number, stroke: RGB) {
  c.page.drawLine({
    start: { x: x1, y: c.H - y1 },
    end: { x: x2, y: c.H - y2 },
    thickness: 1.2,
    color: stroke,
    opacity: 0.45,
    dashArray: [4, 4],
    lineCap: 1,
  })
}

/** QR on a white card (scanners need dark-on-light), merged into row runs. */
function drawQr(c: Canvas, value: string, x: number, y: number, size: number) {
  const { size: n, dark } = qrMatrix(value)
  const pad = size * 0.07
  c.page.drawSvgPath(roundedRectPath(size, size, size * 0.06), { x, y: c.H - y, color: rgb(1, 1, 1) })
  const cell = (size - pad * 2) / n
  const ink = rgb(0.07, 0.05, 0.06)
  for (let row = 0; row < n; row++) {
    let col = 0
    while (col < n) {
      if (!dark[row * n + col]) { col++; continue }
      let end = col
      while (end < n && dark[row * n + end]) end++
      fillRect(c, x + pad + col * cell, y + pad + row * cell, (end - col) * cell + 0.15, cell + 0.15, ink)
      col = end
    }
  }
}

function drawBarcode(c: Canvas, value: string, x: number, y: number, w: number, h: number, ink: RGB, card: RGB | null) {
  const { modules, bars } = code128Bars(value)
  const quiet = 10
  const unit = w / (modules + quiet * 2)
  if (card) c.page.drawSvgPath(roundedRectPath(w, h, 3), { x, y: c.H - y, color: card })
  const pad = card ? 4 : 0
  for (const [start, width] of bars) {
    fillRect(c, x + (quiet + start) * unit, y + pad, width * unit, h - pad * 2, ink)
  }
}

/** Push a rounded-rect clip; the caller pops the graphics state when done. */
function clipRoundedRect(c: Canvas, x: number, top: number, w: number, h: number, r: number) {
  const y = c.H - top - h
  const k = 0.5523 * r
  c.page.pushOperators(
    pushGraphicsState(),
    moveTo(x + r, y),
    lineTo(x + w - r, y),
    appendBezierCurve(x + w - r + k, y, x + w, y + r - k, x + w, y + r),
    lineTo(x + w, y + h - r),
    appendBezierCurve(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h),
    lineTo(x + r, y + h),
    appendBezierCurve(x + r - k, y + h, x, y + h - r + k, x, y + h - r),
    lineTo(x, y + r),
    appendBezierCurve(x, y + r - k, x + r - k, y, x + r, y),
    closePath(),
    clip(),
    endPath(),
  )
}

function roundedRectPath(w: number, h: number, r: number): string {
  return `M${r} 0H${w - r}A${r} ${r} 0 0 1 ${w} ${r}V${h - r}A${r} ${r} 0 0 1 ${w - r} ${h}H${r}A${r} ${r} 0 0 1 0 ${h - r}V${r}A${r} ${r} 0 0 1 ${r} 0Z`
}

function pill(c: Canvas, label: string, x: number, y: number, fonts: Fonts, design: TicketDesign, maxWidth: number) {
  const size = 9
  const spacing = 0.6
  let text = clean(label).toUpperCase()
  while (text.length > 1 && textWidth(text, fonts.mono, size, spacing) > maxWidth - 20) text = text.slice(0, -1)
  const w = textWidth(text, fonts.mono, size, spacing) + 20
  const h = 20
  const { accent, accent2 } = design.colors
  if (design.gradient && accent !== accent2) {
    clipRoundedRect(c, x, y, w, h, h / 2)
    gradientRect(c, x, y, w, h, accent, accent2, true)
    c.page.pushOperators(popGraphicsState())
  } else {
    c.page.drawSvgPath(roundedRectPath(w, h, h / 2), { x, y: c.H - y, color: color(accent) })
  }
  drawLine(c, text, x + 10, y + 13.6, { font: fonts.mono, size, fill: color(inkOn(accent)), spacing })
  return w
}

function headlineFont(fonts: Fonts, design: TicketDesign): { font: PDFFont; leading: number } {
  if (design.headlineFont === 'serif') return { font: fonts.serif, leading: 1.0 }
  if (design.headlineFont === 'sans') return { font: fonts.bodySemibold, leading: 1.08 }
  return { font: fonts.displayBlack, leading: 0.9 }
}

function priceLabel(ticket: TicketPdfTicket, event: TicketPdfEvent, locale: Locale, t: DrawArgs['t']): string {
  if (ticket.comp) return t('comp')
  if (ticket.priceCents === 0) return t('free')
  return formatMoney(ticket.priceCents, event.currency, locale)
}

interface Detail {
  label: string
  value: string
  sub?: string
}

function eventDetails(args: DrawArgs): { date: Detail | null; time: Detail | null; venue: Detail | null } {
  const { input, t } = args
  const { event, design, locale } = input
  const date = design.show.date
    ? { label: t('date'), value: formatEventDate(event.startsAt, event.timezone, locale) }
    : null
  const time = design.show.date
    ? {
        label: t('time'),
        value: formatEventTime(event.startsAt, event.timezone, locale),
        sub: design.show.doors && event.doorsAt ? t('doors', { time: formatEventTime(event.doorsAt, event.timezone, locale, false) }) : undefined,
      }
    : null
  const venueName = clean(event.venueName)
  const venue = design.show.venue && venueName
    ? { label: t('venue'), value: venueName, sub: design.show.address ? clean(event.venueAddress) || undefined : undefined }
    : null
  return { date, time, venue }
}

/** Height from the block top to just below its last line. */
function detailHeight(d: Detail, w: number, fonts: Fonts, valueLines: number): number {
  const lines = wrapText(d.value, fonts.bodySemibold, 10.5, w, valueLines).length
  const sub = d.sub ? wrapText(d.sub, fonts.body, 8.5, w, 2).length : 0
  return 22 + (lines - 1) * 13 + (sub ? 13 + (sub - 1) * 11 : 0) + 3
}

function drawDetail(c: Canvas, d: Detail, x: number, y: number, w: number, fonts: Fonts, design: TicketDesign, valueLines = 2) {
  drawLine(c, d.label.toUpperCase(), x, y + 7, { font: fonts.mono, size: 7, fill: color(design.colors.muted), spacing: 1.1 })
  const lines = wrapText(d.value, fonts.bodySemibold, 10.5, w, valueLines)
  lines.forEach((line, i) => drawLine(c, line, x, y + 22 + i * 13, { font: fonts.bodySemibold, size: 10.5, fill: color(design.colors.text) }))
  if (d.sub) {
    const subLines = wrapText(d.sub, fonts.body, 8.5, w, 2)
    subLines.forEach((line, i) => drawLine(c, line, x, y + 22 + lines.length * 13 + i * 11, { font: fonts.body, size: 8.5, fill: color(design.colors.muted) }))
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Layout: classic stub (landscape, tear-off QR stub on the right)
// ──────────────────────────────────────────────────────────────────────────

function drawStub(args: DrawArgs) {
  const { doc, input, fonts, logo, image, ticket, t } = args
  const { design, event, locale } = input
  const W = 810, H = 324
  const page = doc.addPage([W, H])
  const c: Canvas = { page, H }
  const col = design.colors
  const box = { x0: 18, y0: 18, x1: W - 18, y1: H - 18 }
  const stubW = 214
  const px = box.x1 - stubW

  fillRect(c, 0, 0, W, H, color(col.background))

  // Art panel or accent band on the left edge.
  let cx: number
  if (image) {
    const panel = 196
    imageCover(c, image, box.x0, box.y0, panel, box.y1 - box.y0, 1)
    fillRect(c, box.x0, box.y0, panel, box.y1 - box.y0, color(col.background), 1 - design.imageStrength)
    fadeRect(c, box.x0 + panel - 80, box.y0, 82, box.y1 - box.y0, col.background, 'right')
    cx = box.x0 + panel + 4
  } else {
    if (design.gradient) gradientRect(c, box.x0, box.y0, 12, box.y1 - box.y0, col.accent, col.accent2, false)
    else fillRect(c, box.x0, box.y0, 12, box.y1 - box.y0, color(col.accent))
    cx = box.x0 + 12 + 30
  }
  // Thin accent rule across the top of the stub.
  if (design.gradient) gradientRect(c, px, box.y0, stubW, 5, col.accent, col.accent2, true)
  else fillRect(c, px, box.y0, stubW, 5, color(col.accent))

  const cw = px - 26 - cx

  // Bottom block, measured first so the headline fits the space left above it.
  const footer = clean(design.footer[locale] || design.footer.en)
  const footerLines = footer ? wrapText(footer, fonts.body, 7.2, cw, 2) : []
  const footerTop = box.y1 - 16 - footerLines.length * 9.5
  const details = eventDetails(args)
  const cols = [details.date, details.time, details.venue].filter((d): d is Detail => !!d)
  const weights = cols.map((d) => (d === details.venue ? 1.3 : d === details.date ? 1.1 : 0.7))
  const totalWeight = weights.reduce((a, b) => a + b, 0)
  const colWidths = weights.map((wt) => (cw - (cols.length - 1) * 16) * (wt / totalWeight))
  const detailH = Math.max(0, ...cols.map((d, i) => detailHeight(d, colWidths[i], fonts, 2)))
  const detailTop = footerTop - (footerLines.length ? 12 : 0) - detailH
  const pillTop = detailTop - (cols.length ? 34 : 14)

  let cy = box.y0 + 24
  if (logo) {
    const { h } = imageContain(c, logo, cx, cy, Math.min(170, cw), 20)
    cy += h + 16
  }
  const eyebrow = clean(design.eyebrow[locale] || design.eyebrow.en)
  if (eyebrow) {
    const line = wrapText(eyebrow.toUpperCase(), fonts.mono, 8, cw, 1, 1.4)[0]
    drawLine(c, line, cx, cy + 7, { font: fonts.mono, size: 8, fill: color(col.accent), spacing: 1.4 })
    cy += 7 + 12
  }

  const head = headlineFont(fonts, design)
  const title = design.uppercaseHeadline ? clean(event.title).toUpperCase() : clean(event.title)
  const subtitle = clean(event.subtitle)
  const subtitleH = subtitle ? 30 : 0
  const room = pillTop - 14 - cy - subtitleH
  const fit = fitText(title, head.font, cw, room, 2, 44, 20, head.leading)
  fit.lines.forEach((line, i) => {
    drawLine(c, line, cx, cy + fit.size * 0.8 + i * fit.size * head.leading, { font: head.font, size: fit.size, fill: color(col.text) })
  })
  cy += fit.lines.length * fit.size * head.leading + 4
  if (subtitle) {
    const lines = wrapText(subtitle, fonts.body, 11, cw, 2)
    lines.forEach((line, i) => drawLine(c, line, cx, cy + 12 + i * 13.5, { font: fonts.body, size: 11, fill: color(col.muted) }))
  }

  // Tier pill + attendee.
  let rowX = cx
  if (design.show.tier) {
    const label = design.show.price ? `${ticket.tierName} · ${priceLabel(ticket, event, locale, t)}` : ticket.tierName
    rowX += pill(c, label, cx, pillTop, fonts, design, cw * 0.6) + 14
  }
  if (design.show.attendee && ticket.attendeeName) {
    const name = wrapText(ticket.attendeeName, fonts.bodySemibold, 11, cx + cw - rowX, 1)[0]
    drawLine(c, name, rowX, pillTop + 14.2, { font: fonts.bodySemibold, size: 11, fill: color(col.text) })
  }

  // Details grid.
  let dx = cx
  cols.forEach((d, i) => {
    drawDetail(c, d, dx, detailTop, colWidths[i], fonts, design, 2)
    dx += colWidths[i] + 16
  })

  footerLines.forEach((line, i) => drawLine(c, line, cx, footerTop + 7 + i * 9.5, { font: fonts.body, size: 7.2, fill: color(col.muted) }))

  // Stub: admit label, tier, QR, ticket number, barcode.
  const sx = px + 22
  const sw = stubW - 44
  drawLine(c, t('admitOne').toUpperCase(), sx, box.y0 + 26, { font: fonts.mono, size: 7.5, fill: color(col.muted), spacing: 1.2 })
  const stubTier = design.show.tier ? ticket.tierName : t('ticket')
  drawLine(c, wrapText(stubTier, fonts.bodySemibold, 11.5, sw, 1)[0], sx, box.y0 + 42, { font: fonts.bodySemibold, size: 11.5, fill: color(col.text) })
  const qrSize = 134
  const qrY = box.y0 + 54
  drawQr(c, ticketUrl(input.appUrl, ticket.code), px + (stubW - qrSize) / 2, qrY, qrSize)
  drawLine(c, ticket.ticketNumber, sx, qrY + qrSize + 18, { font: fonts.mono, size: 11, fill: color(col.text), spacing: 0.6, align: 'center', width: sw })
  if (design.show.orderRef && ticket.orderRef) {
    drawLine(c, t('order', { ref: ticket.orderRef }), sx, qrY + qrSize + 31, { font: fonts.mono, size: 7.5, fill: color(col.muted), align: 'center', width: sw })
  }
  if (design.show.barcode) {
    drawBarcode(c, ticket.ticketNumber, sx, box.y1 - 46, sw, 30, rgb(0.07, 0.05, 0.06), rgb(1, 1, 1))
  }

  perforation(c, px, box.y0 + 16, px, box.y1 - 16, color(col.muted))
  silhouetteMask(c, W, box, 16, { axis: 'x', at: px, radius: 11 }, color(col.backdrop))
}

// ──────────────────────────────────────────────────────────────────────────
// Layout: mobile pass (portrait, artwork on top, QR section below)
// ──────────────────────────────────────────────────────────────────────────

function drawPass(args: DrawArgs) {
  const { doc, input, fonts, logo, image, ticket, t } = args
  const { design, event, locale } = input
  const W = 400, H = 800
  const page = doc.addPage([W, H])
  const c: Canvas = { page, H }
  const col = design.colors
  const box = { x0: 16, y0: 16, x1: W - 16, y1: H - 16 }
  const tw = box.x1 - box.x0
  const py = box.y1 - 292
  const cx = box.x0 + 24
  const cw = tw - 48

  fillRect(c, 0, 0, W, H, color(col.background))

  let cy: number
  if (image) {
    const heroH = 156
    imageCover(c, image, box.x0, box.y0, tw, heroH, 1)
    fillRect(c, box.x0, box.y0, tw, heroH, color(col.background), 1 - design.imageStrength)
    fadeRect(c, box.x0, box.y0 + heroH - 70, tw, 72, col.background, 'down')
    if (logo) {
      // Scrim so the logo reads over busy artwork.
      fadeRect(c, box.x0, box.y0, tw, 90, col.background, 'up', 0.85)
      imageContain(c, logo, cx, box.y0 + 22, Math.min(160, cw), 18)
    }
    cy = box.y0 + heroH + 14
  } else {
    if (design.gradient) gradientRect(c, box.x0, box.y0, tw, 8, col.accent, col.accent2, true)
    else fillRect(c, box.x0, box.y0, tw, 8, color(col.accent))
    cy = box.y0 + 34
    if (logo) {
      const { h } = imageContain(c, logo, cx, cy, Math.min(170, cw), 20)
      cy += h + 20
    }
  }

  const eyebrow = clean(design.eyebrow[locale] || design.eyebrow.en)
  if (eyebrow) {
    const line = wrapText(eyebrow.toUpperCase(), fonts.mono, 8, cw, 1, 1.4)[0]
    drawLine(c, line, cx, cy + 7, { font: fonts.mono, size: 8, fill: color(col.accent), spacing: 1.4 })
    cy += 7 + 12
  }

  // Details flow under the subtitle; the tier pill sits just above the perforation.
  const details = eventDetails(args)
  const pillTop = py - 22 - 20
  const half = (cw - 16) / 2
  const dateRowH = Math.max(
    details.date ? detailHeight(details.date, half, fonts, 2) : 0,
    details.time ? detailHeight(details.time, half, fonts, 1) : 0,
  )
  const venueH = details.venue ? detailHeight(details.venue, cw, fonts, 2) : 0
  const detailsH = dateRowH + (dateRowH && venueH ? 14 : 0) + venueH

  const head = headlineFont(fonts, design)
  const title = design.uppercaseHeadline ? clean(event.title).toUpperCase() : clean(event.title)
  const subtitle = clean(event.subtitle)
  const subtitleH = subtitle ? 32 : 0
  const room = pillTop - 20 - detailsH - 22 - cy - subtitleH
  const fit = fitText(title, head.font, cw, room, 3, 38, 18, head.leading)
  fit.lines.forEach((line, i) => {
    drawLine(c, line, cx, cy + fit.size * 0.8 + i * fit.size * head.leading, { font: head.font, size: fit.size, fill: color(col.text) })
  })
  cy += fit.lines.length * fit.size * head.leading + 4
  if (subtitle) {
    const lines = wrapText(subtitle, fonts.body, 11, cw, 2)
    lines.forEach((line, i) => drawLine(c, line, cx, cy + 12 + i * 13.5, { font: fonts.body, size: 11, fill: color(col.muted) }))
    cy += lines.length * 13.5 + 4
  }

  cy += 22
  if (details.date) drawDetail(c, details.date, cx, cy, half, fonts, design, 2)
  if (details.time) drawDetail(c, details.time, cx + half + 16, cy, half, fonts, design, 1)
  if (dateRowH) cy += dateRowH + (venueH ? 14 : 0)
  if (details.venue) drawDetail(c, details.venue, cx, cy, cw, fonts, design, 2)

  let rowX = cx
  if (design.show.tier) {
    const label = design.show.price ? `${ticket.tierName} · ${priceLabel(ticket, event, locale, t)}` : ticket.tierName
    rowX += pill(c, label, cx, pillTop, fonts, design, cw * 0.62) + 12
  }
  if (design.show.attendee && ticket.attendeeName) {
    const name = wrapText(ticket.attendeeName, fonts.bodySemibold, 11, cx + cw - rowX, 1)[0]
    drawLine(c, name, rowX, pillTop + 14.2, { font: fonts.bodySemibold, size: 11, fill: color(col.text) })
  }

  // Lower section.
  const qrSize = 158
  const qrY = py + 24
  drawQr(c, ticketUrl(input.appUrl, ticket.code), (W - qrSize) / 2, qrY, qrSize)
  drawLine(c, ticket.ticketNumber, box.x0, qrY + qrSize + 20, { font: fonts.mono, size: 12, fill: color(col.text), spacing: 0.8, align: 'center', width: tw })
  const meta = [t('admitOne'), design.show.orderRef && ticket.orderRef ? t('order', { ref: ticket.orderRef }) : null].filter(Boolean).join('  ·  ')
  drawLine(c, meta.toUpperCase(), box.x0, qrY + qrSize + 34, { font: fonts.mono, size: 7.2, fill: color(col.muted), spacing: 1, align: 'center', width: tw })
  let by = qrY + qrSize + 44
  if (design.show.barcode) {
    drawBarcode(c, ticket.ticketNumber, (W - 220) / 2, by, 220, 32, rgb(0.07, 0.05, 0.06), rgb(1, 1, 1))
    by += 32
  }
  const footer = clean(design.footer[locale] || design.footer.en)
  if (footer) {
    const lines = wrapText(footer, fonts.body, 7.2, cw, 3)
    const top = Math.max(by + 12, box.y1 - 18 - lines.length * 9.5)
    lines.forEach((line, i) => drawLine(c, line, cx, top + 7 + i * 9.5, { font: fonts.body, size: 7.2, fill: color(col.muted), align: 'center', width: cw }))
  }

  perforation(c, box.x0 + 18, py, box.x1 - 18, py, color(col.muted))
  silhouetteMask(c, W, box, 18, { axis: 'y', at: py, radius: 12 }, color(col.backdrop))
}
