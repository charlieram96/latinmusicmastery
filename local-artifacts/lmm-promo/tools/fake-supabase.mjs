// Minimal stand-in for the Supabase REST/Auth endpoints so the local dev
// server can render authenticated dashboard pages for screen captures.
import http from 'node:http';
const UID = '11111111-2222-3333-4444-555555555555';
const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);
const jwt = () => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: UID, aud: 'authenticated', role: 'authenticated', email: 'sofia@example.com', exp: now() + 86400 * 30, iat: now() })}.sig`;
const user = { id: UID, aud: 'authenticated', role: 'authenticated', email: 'sofia@example.com', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'email' }, user_metadata: { full_name: 'Sofía Ramírez' }, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-10-01T00:00:00Z' };
const session = () => ({ access_token: jwt(), token_type: 'bearer', expires_in: 86400 * 30, expires_at: now() + 86400 * 30, refresh_token: 'fake-refresh', user });
let FIX = {};
try { FIX = JSON.parse((await import('node:fs')).readFileSync(process.env.FIXTURES || '/dev/null', 'utf8') || '{}'); } catch { FIX = {}; }
FIX.profiles ??= [{ id: UID, is_admin: false, email: 'sofia@example.com', full_name: 'Sofía Ramírez', avatar_url: null }];
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let body = '';
  req.on('data', c => body += c);
  req.on('end', () => {
    const send = (code, obj, headers = {}) => { res.writeHead(code, { 'content-type': 'application/json', ...headers }); res.end(obj === undefined ? '' : JSON.stringify(obj)); };
    const p = url.pathname;
    if (process.env.LOG) console.log(req.method, p, url.search.slice(0, 160));
    if (p.startsWith('/auth/v1/token')) return send(200, session());
    if (p === '/auth/v1/user') return send(200, user);
    if (p.startsWith('/auth/v1/logout')) return send(204);
    if (p.startsWith('/auth/v1/')) return send(200, {});
    if (p.startsWith('/rest/v1/rpc/')) return send(200, FIX['rpc:' + p.slice(13)] ?? null);
    if (p.startsWith('/rest/v1/')) {
      const table = p.slice(9);
      const rows = FIX[table] ?? [];
      const headers = { 'content-range': `0-${Math.max(rows.length - 1, 0)}/${rows.length}` };
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(201, rows.slice(0, 1), headers);
      if (req.method === 'HEAD') return send(200, undefined, headers);
      if ((req.headers.accept || '').includes('vnd.pgrst.object')) {
        if (!rows.length) return send(406, { code: 'PGRST116', details: 'The result contains 0 rows', hint: null, message: 'JSON object requested, multiple (or no) rows returned' });
        return send(200, rows[0], headers);
      }
      return send(200, rows, headers);
    }
    return send(404, { message: 'not found' });
  });
});
server.listen(54321, '127.0.0.1', () => console.log('fake supabase on 54321'));
