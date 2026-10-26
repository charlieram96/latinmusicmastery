// Identifiers printed on and encoded in tickets.
//
//   ticket number  LMM-7K3Q-9XW2   printed, in the barcode, typed by door staff.
//                                 Crockford base32 (no I/L/O/U) so it reads
//                                 aloud and survives O/0 and I/1 mix-ups.
//   code           22-char secret  in the QR (as a /t/<code> URL); also the
//                                 key to the holder's ticket page.
//   tokens         order access tokens and scanner-link tokens (secrets).

import { randomBytes } from 'node:crypto'

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'
export const TICKET_NUMBER_PREFIX = 'LMM'
const TICKET_NUMBER_RE = /^LMM-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$/
const CODE_RE = /^[A-Za-z0-9_-]{22}$/

export function generateTicketNumber(): string {
  const bytes = randomBytes(8)
  let body = ''
  for (let i = 0; i < 8; i++) body += CROCKFORD[bytes[i] % 32]
  return `${TICKET_NUMBER_PREFIX}-${body.slice(0, 4)}-${body.slice(4)}`
}

/** 128-bit URL-safe secret (22 chars). */
export function generateSecret(): string {
  return randomBytes(16).toString('base64url')
}

export function isTicketNumber(value: string): boolean {
  return TICKET_NUMBER_RE.test(value)
}

/**
 * Canonicalise a typed or scanned ticket number: case, spacing, hyphens and
 * the usual look-alikes (O→0, I/L→1). Returns null when it cannot be one.
 */
export function normalizeTicketNumber(raw: string): string | null {
  let s = raw.toUpperCase().replace(/[\s-]/g, '')
  if (s.startsWith(TICKET_NUMBER_PREFIX)) s = s.slice(TICKET_NUMBER_PREFIX.length)
  s = s.replace(/O/g, '0').replace(/[IL]/g, '1')
  if (s.length !== 8) return null
  const candidate = `${TICKET_NUMBER_PREFIX}-${s.slice(0, 4)}-${s.slice(4)}`
  return isTicketNumber(candidate) ? candidate : null
}

export type ScannedValue =
  | { kind: 'code'; code: string }
  | { kind: 'number'; ticketNumber: string }
  | { kind: 'invalid' }

/**
 * Interpret whatever a scanner produced: a ticket QR (`…/t/<code>`), a bare
 * code, a Code 128 barcode or a hand-typed ticket number.
 */
export function parseScannedValue(raw: string): ScannedValue {
  const value = raw.trim()
  const fromUrl = value.match(/\/t\/([A-Za-z0-9_-]{22})(?:[/?#]|$)/)
  if (fromUrl) return { kind: 'code', code: fromUrl[1] }
  // Codes are exactly 22 chars; ticket numbers at most 13, so length decides.
  if (CODE_RE.test(value)) return { kind: 'code', code: value }
  const ticketNumber = normalizeTicketNumber(value)
  if (ticketNumber) return { kind: 'number', ticketNumber }
  return { kind: 'invalid' }
}

// Pure, so client components can import it from ./format directly.
export { orderReference } from './format'
