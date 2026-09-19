import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ user: null as null | { id: string }, admin: false, recognize: vi.fn() }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => ({
  auth: { getUser: async () => ({ data: { user: state.user } }) },
  from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: { is_admin: state.admin } }) }) }) }),
}) }));
vi.mock('@/lib/playsense-studio/pdf/recognize', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/playsense-studio/pdf/recognize')>(), recognizePdf: state.recognize,
}));
import { POST } from '../route';

describe('PDF import authorization and transport', () => {
  beforeEach(() => { state.user = null; state.admin = false; state.recognize.mockReset(); });
  const request = (type = 'application/pdf') => new Request('http://localhost/api/playsense/import-pdf', {
    method: 'POST', headers: { 'Content-Type': type, 'X-Score-Percussion': 'true', 'X-Score-Title': encodeURIComponent('Cáscara') }, body: '%PDF-test',
  });
  it('requires sign-in before processing a document', async () => {
    expect((await POST(request())).status).toBe(401); expect(state.recognize).not.toHaveBeenCalled();
  });
  it('requires admin access', async () => {
    state.user = { id: 'test' };
    expect((await POST(request())).status).toBe(403); expect(state.recognize).not.toHaveBeenCalled();
  });
  it('rejects non-PDF uploads', async () => {
    state.user = { id: 'test' }; state.admin = true;
    expect((await POST(request('text/plain'))).status).toBe(415); expect(state.recognize).not.toHaveBeenCalled();
  });
  it('forwards percussion and cancellation and never caches recognition output', async () => {
    state.user = { id: 'test' }; state.admin = true;
    const output = { documents: [{ title: 'example' }] };
    state.recognize.mockResolvedValue(output);
    const input = request(); const response = await POST(input);
    expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toEqual(output);
    expect(state.recognize).toHaveBeenCalledWith(Buffer.from('%PDF-test'), { percussion: true, title: 'Cáscara', signal: input.signal });
  });
});
