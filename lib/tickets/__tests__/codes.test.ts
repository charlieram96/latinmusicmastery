import { describe, expect, it } from 'vitest'
import { generateSecret, generateTicketNumber, isTicketNumber, normalizeTicketNumber, orderReference, parseScannedValue } from '../codes'

describe('ticket numbers', () => {
  it('generates unique Crockford numbers', () => {
    const numbers = new Set(Array.from({ length: 2000 }, generateTicketNumber))
    expect(numbers.size).toBe(2000)
    for (const n of numbers) {
      expect(isTicketNumber(n)).toBe(true)
      expect(n.slice(4)).not.toMatch(/[ILOU]/)
    }
  })

  it('normalises typed numbers and look-alike characters', () => {
    expect(normalizeTicketNumber('lmm-7k3q-9xw2')).toBe('LMM-7K3Q-9XW2')
    expect(normalizeTicketNumber(' LMM 7K3Q 9XW2 ')).toBe('LMM-7K3Q-9XW2')
    expect(normalizeTicketNumber('7k3q9xw2')).toBe('LMM-7K3Q-9XW2')
    expect(normalizeTicketNumber('LMM-OK3Q-IXW2')).toBe('LMM-0K3Q-1XW2')
    expect(normalizeTicketNumber('LMM-7K3Q')).toBeNull()
    expect(normalizeTicketNumber('LMM-7K3Q-9XWU')).toBeNull()
  })
})

describe('parseScannedValue', () => {
  const code = 'AbCdEfGhIjKlMnOpQrStUv'
  it('reads ticket QR URLs', () => {
    expect(parseScannedValue(`https://latinmusicmastery.com/t/${code}`)).toEqual({ kind: 'code', code })
    expect(parseScannedValue(`http://localhost:3000/t/${code}?x=1`)).toEqual({ kind: 'code', code })
  })
  it('reads bare codes, including ones that happen to start with LMM', () => {
    expect(parseScannedValue(code)).toEqual({ kind: 'code', code })
    expect(parseScannedValue('LMMdEfGhIjKlMnOpQrStUv')).toEqual({ kind: 'code', code: 'LMMdEfGhIjKlMnOpQrStUv' })
    const secret = generateSecret()
    expect(parseScannedValue(secret)).toEqual({ kind: 'code', code: secret })
  })
  it('reads barcodes and typed ticket numbers', () => {
    expect(parseScannedValue('LMM-7K3Q-9XW2')).toEqual({ kind: 'number', ticketNumber: 'LMM-7K3Q-9XW2' })
    expect(parseScannedValue('7k3q 9xw2')).toEqual({ kind: 'number', ticketNumber: 'LMM-7K3Q-9XW2' })
  })
  it('rejects anything else', () => {
    expect(parseScannedValue('https://example.com/not-a-ticket')).toEqual({ kind: 'invalid' })
    expect(parseScannedValue('')).toEqual({ kind: 'invalid' })
  })
})

describe('orderReference', () => {
  it('shortens order ids', () => {
    expect(orderReference('3f9a12bc-1234-4abc-9def-001122334455')).toBe('3F9A12BC')
  })
})
