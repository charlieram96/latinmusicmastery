import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  insert: vi.fn(),
  update: vi.fn(),
  send: vi.fn(),
  insertResult: { data: { id: 'row-1' }, error: null } as { data: { id: string } | null; error: unknown },
}));

vi.mock('@/lib/supabase/admin', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({
      insert: (row: unknown) => { state.insert(row); return { select: () => ({ single: async () => state.insertResult }) }; },
      update: (patch: unknown) => ({ eq: async (col: string, id: string) => { state.update(patch, col, id); return { error: null }; } }),
    }),
  }),
}));
vi.mock('@/lib/email/sendgrid', () => ({ sendEmail: state.send }));

import { POST } from '../route';

const valid = { name: 'Ana Pérez', email: 'ana@example.com', subject: 'Billing', message: 'Hola, tengo una pregunta <b>sobre</b> mi plan.' };
const post = (body: unknown) => POST(new Request('http://localhost/api/contact', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: typeof body === 'string' ? body : JSON.stringify(body),
}));

describe('POST /api/contact', () => {
  beforeEach(() => {
    state.insert.mockReset(); state.update.mockReset(); state.send.mockReset();
    state.insertResult = { data: { id: 'row-1' }, error: null };
    state.send.mockResolvedValue({ sent: 1, failed: 0, errors: [] });
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('stores the message, emails the team with reply-to set to the sender, and marks it notified', async () => {
    const res = await post({ ...valid, name: '  Ana Pérez ' });
    expect(res.status).toBe(200);
    expect(state.insert).toHaveBeenCalledWith({ name: 'Ana Pérez', email: 'ana@example.com', subject: 'Billing', message: valid.message });
    const mail = state.send.mock.calls[0][0];
    expect(mail.replyTo).toBe('ana@example.com');
    expect(mail.to).toEqual(['support@latinmusicmastery.com']);
    expect(mail.html).toContain('&lt;b&gt;sobre&lt;/b&gt;');
    expect(mail.html).not.toContain('<b>sobre</b>');
    expect(state.update).toHaveBeenCalledWith({ notified_at: expect.any(String) }, 'id', 'row-1');
  });

  it('still succeeds when the email fails, leaving the saved row unnotified', async () => {
    state.send.mockResolvedValue({ sent: 0, failed: 1, errors: [{ email: 'x', reason: 'nope' }] });
    expect((await post(valid)).status).toBe(200);
    expect(state.update).not.toHaveBeenCalled();
    state.send.mockRejectedValue(new Error('SENDGRID_API_KEY is not set'));
    expect((await post(valid)).status).toBe(200);
  });

  it('reports a failure when the message cannot be stored', async () => {
    state.insertResult = { data: null, error: { message: 'boom' } };
    const res = await post(valid);
    expect(res.status).toBe(500);
    expect(state.send).not.toHaveBeenCalled();
  });

  it.each([
    ['short name', { name: 'A' }],
    ['long name', { name: 'a'.repeat(101) }],
    ['bad email', { email: 'nope' }],
    ['unknown subject', { subject: 'Other' }],
    ['short message', { message: 'hi' }],
    ['long message', { message: 'a'.repeat(5001) }],
    ['non-string message', { message: 12345678901 }],
  ])('rejects a %s', async (_label, patch) => {
    expect((await post({ ...valid, ...patch })).status).toBe(400);
    expect(state.insert).not.toHaveBeenCalled();
  });

  it('rejects a body that is not JSON', async () => {
    expect((await post('not json')).status).toBe(400);
  });

  it('silently drops honeypot submissions', async () => {
    expect((await post({ ...valid, company: 'Spam LLC' })).status).toBe(200);
    expect(state.insert).not.toHaveBeenCalled();
    expect(state.send).not.toHaveBeenCalled();
  });
});
