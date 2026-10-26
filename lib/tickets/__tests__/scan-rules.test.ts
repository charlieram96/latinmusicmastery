import { describe, expect, it } from 'vitest'
import { decideScan, isEntryOutcome } from '../scan-rules'

const ok = { eventId: 'e1', status: 'valid', orderStatus: 'paid' }

describe('decideScan', () => {
  it('admits a valid ticket once, or only verifies in verify mode', () => {
    expect(decideScan(ok, 'e1', 'checkin')).toBe('admitted')
    expect(decideScan(ok, 'e1', 'verify')).toBe('verified')
    expect(decideScan({ ...ok, orderStatus: 'comp' }, 'e1', 'checkin')).toBe('admitted')
  })
  it('flags duplicates, voids, refunds and other events', () => {
    expect(decideScan({ ...ok, status: 'checked_in' }, 'e1', 'checkin')).toBe('already_checked_in')
    expect(decideScan({ ...ok, status: 'void' }, 'e1', 'checkin')).toBe('void')
    expect(decideScan({ ...ok, orderStatus: 'refunded' }, 'e1', 'checkin')).toBe('refunded')
    expect(decideScan({ ...ok, orderStatus: 'pending' }, 'e1', 'checkin')).toBe('void')
    expect(decideScan(ok, 'e2', 'checkin')).toBe('wrong_event')
    expect(decideScan(null, 'e1', 'checkin')).toBe('not_found')
  })
  it('only lets admitted/verified through', () => {
    expect(isEntryOutcome('admitted')).toBe(true)
    expect(isEntryOutcome('verified')).toBe(true)
    expect(isEntryOutcome('already_checked_in')).toBe(false)
  })
})
