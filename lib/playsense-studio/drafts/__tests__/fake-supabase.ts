// In-memory stand-in for the subset of the Supabase query builder the draft
// actions use: select/eq/neq/in/order/limit/single/maybeSingle/insert/update/delete.
type Row = Record<string, unknown>;
type Result = { data: unknown; error: { message: string } | null };

export function createFakeSupabase(seed: Record<string, Row[]>, opts: { userId?: string | null; isAdmin?: boolean } = {}) {
  const tables: Record<string, Row[]> = {};
  for (const [k, rows] of Object.entries(seed)) tables[k] = rows.map((r) => ({ ...r }));
  const userId = opts.userId === undefined ? 'admin-1' : opts.userId;
  tables.profiles ??= userId ? [{ id: userId, is_admin: opts.isAdmin ?? true }] : [];
  let seq = 0;

  function from(table: string) {
    tables[table] ??= [];
    const filters: Array<(r: Row) => boolean> = [];
    let op: 'select' | 'insert' | 'update' | 'delete' = 'select';
    let payload: Row[] = [];
    let patch: Row = {};
    let order: { col: string; asc: boolean } | null = null;
    let limit: number | null = null;
    let mode: 'many' | 'single' | 'maybe' = 'many';

    const run = (): Result => {
      const all = tables[table];
      if (op === 'insert') {
        all.push(...payload);
        return finish(payload);
      }
      const hit = all.filter((r) => filters.every((f) => f(r)));
      if (op === 'update') {
        hit.forEach((r) => Object.assign(r, patch));
        return finish(hit);
      }
      if (op === 'delete') {
        tables[table] = all.filter((r) => !hit.includes(r));
        return finish(hit);
      }
      let out = [...hit];
      if (order) {
        const { col, asc } = order;
        out.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1));
      }
      if (limit != null) out = out.slice(0, limit);
      return finish(out);
    };
    const finish = (rows: Row[]): Result => {
      if (mode === 'many') return { data: rows.map((r) => ({ ...r })), error: null };
      if (rows.length === 0) return mode === 'maybe' ? { data: null, error: null } : { data: null, error: { message: 'No rows' } };
      return { data: { ...rows[0] }, error: null };
    };

    const q = {
      select: (_cols?: string) => q,
      eq: (c: string, v: unknown) => (filters.push((r) => r[c] === v), q),
      neq: (c: string, v: unknown) => (filters.push((r) => r[c] !== v), q),
      in: (c: string, vs: unknown[]) => (filters.push((r) => vs.includes(r[c])), q),
      order: (col: string, o?: { ascending?: boolean }) => ((order = { col, asc: o?.ascending ?? true }), q),
      limit: (n: number) => ((limit = n), q),
      single: () => ((mode = 'single'), q),
      maybeSingle: () => ((mode = 'maybe'), q),
      insert: (rows: Row | Row[]) => {
        op = 'insert';
        payload = (Array.isArray(rows) ? rows : [rows]).map((r) => ({ id: `id-${++seq}`, ...r }));
        return q;
      },
      update: (p: Row) => ((op = 'update'), (patch = p), q),
      delete: () => ((op = 'delete'), q),
      then: <T>(resolve: (r: Result) => T, reject?: (e: unknown) => T) => Promise.resolve().then(run).then(resolve, reject),
    };
    return q;
  }

  const client = {
    auth: { getUser: async () => ({ data: { user: userId ? { id: userId } : null } }) },
    from,
  };
  return { client, tables };
}
