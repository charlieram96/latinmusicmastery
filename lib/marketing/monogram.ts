/**
 * Photo fallback for teachers without a portrait: their initials set large
 * over the Noche palette, as an SVG data URI that drops straight into the
 * same <Image> slot a photo would use.
 */

/** First and last initial, ignoring a quoted nickname (`Patricio "el chino" Diaz` → `PD`). */
export function initials(name: string): string {
  const words = name.replace(/["“][^"”]*["”]/g, ' ').trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return ''
  const first = words[0].charAt(0)
  const last = words.length > 1 ? words[words.length - 1].charAt(0) : ''
  return (first + last).toUpperCase()
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export function monogramDataUri(name: string): string {
  const text = esc(initials(name))
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400" preserveAspectRatio="xMidYMid slice">`
    + `<defs><radialGradient id="g" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#3a2530"/><stop offset="1" stop-color="#170F1B"/></radialGradient>`
    + `<linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFA524"/><stop offset=".5" stop-color="#FF6A3A"/><stop offset="1" stop-color="#FF324D"/></linearGradient></defs>`
    + `<rect width="300" height="400" fill="url(#g)"/>`
    + `<circle cx="150" cy="160" r="104" fill="none" stroke="#F6EBDD" stroke-opacity=".14" stroke-width="1.5"/>`
    + `<text x="150" y="160" text-anchor="middle" dominant-baseline="central" font-family="'Big Shoulders Display','Arial Narrow',Impact,sans-serif" font-weight="800" font-size="120" letter-spacing="2" fill="url(#t)">${text}</text>`
    + `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
