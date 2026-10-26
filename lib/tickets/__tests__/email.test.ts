import { describe, expect, it } from 'vitest'
import { composeOrderEmail } from '../email'
import type { OrderBundle } from '../types'

function bundle(overrides: { status?: string; locale?: string; buyer?: string; messageEs?: string | null } = {}): OrderBundle {
  const tier = { id: 't1', event_id: 'e1', name: 'VIP', name_es: 'VIP primera fila', description: null, description_es: null, price_cents: 6000, capacity: null, sales_start_at: null, sales_end_at: null, is_active: true, sort_order: 0, created_at: '', updated_at: '' }
  return {
    order: {
      id: '3f9a12bc-1234-4abc-9def-001122334455', event_id: 'e1', status: overrides.status ?? 'paid', source: 'stripe',
      buyer_name: overrides.buyer ?? 'Ana', buyer_email: 'ana@example.com', user_id: null, locale: overrides.locale ?? 'en',
      access_token: 'AbCdEfGhIjKlMnOpQrStUv', amount_total_cents: 12000, currency: 'usd', stripe_checkout_session_id: null,
      stripe_payment_intent_id: null, expires_at: null, paid_at: null, refunded_at: null, cancelled_at: null, email_status: 'pending',
      email_sent_at: null, email_error: null, notes: null, created_by: null, created_at: '', updated_at: '',
    },
    event: {
      id: 'e1', slug: 'noche', status: 'published', title: 'Noche', title_es: 'Noche ES', subtitle: null, subtitle_es: null, description: null,
      description_es: null, venue_name: 'Club', venue_address: null, starts_at: '2026-11-22T01:00:00Z', ends_at: null, doors_at: null,
      timezone: 'America/New_York', currency: 'usd', capacity: null, max_per_order: 10, image_url: null, ticket_design: {},
      email_message: 'Bring ID & <smile>', email_message_es: overrides.messageEs ?? null, created_by: null, created_at: '', updated_at: '',
    },
    items: [{ id: 'i1', order_id: 'o', tier_id: 't1', quantity: 2, unit_price_cents: 6000, tier }],
    tickets: [1, 2].map((seq) => ({
      id: `k${seq}`, order_id: 'o', event_id: 'e1', tier_id: 't1', seq, ticket_number: `LMM-AAAA-000${seq}`, code: 'x'.repeat(22),
      attendee_name: 'Ana', status: seq === 2 ? 'void' : 'valid', checked_in_at: null, checked_in_by: null, voided_at: null, created_at: '', tier,
    })),
  }
}

describe('composeOrderEmail', () => {
  it('lists live tickets, the order link and escapes user content', () => {
    const { subject, html, text } = composeOrderEmail(bundle({ buyer: '<b>Ana</b>' }))
    expect(subject).toBe('Your tickets for Noche')
    expect(html).toContain('LMM-AAAA-0001')
    expect(html).not.toContain('LMM-AAAA-0002')
    expect(html).toContain('/tickets/AbCdEfGhIjKlMnOpQrStUv')
    expect(html).toContain('&lt;b&gt;Ana&lt;/b&gt;')
    expect(html).not.toContain('<b>Ana</b>')
    expect(html).toContain('Bring ID &amp; &lt;smile&gt;')
    expect(html).toContain('$120')
    expect(text).toContain('Your ticket is attached')
  })

  it('uses Spanish copy, labels an English-only organizer message and words comps as gifts', () => {
    const { subject, html } = composeOrderEmail(bundle({ status: 'comp', locale: 'es' }))
    expect(subject).toBe('Tus entradas para Noche ES')
    expect(html).toContain('VIP primera fila')
    expect(html).toContain('entrada de cortesía')
    expect(html).toContain('Mensaje del organizador (en inglés):')
    expect(html).not.toContain('$120')
    const authored = composeOrderEmail(bundle({ locale: 'es', messageEs: 'Trae tu ID' })).html
    expect(authored).toContain('Trae tu ID')
    expect(authored).not.toContain('(en inglés)')
  })
})
