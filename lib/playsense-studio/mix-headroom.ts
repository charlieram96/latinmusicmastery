/** Keep the sum of enabled stems within digital full scale without changing
 * the authored balance. Muting a stem must not change its saved fader. */
export function mixHeadroom(ids: readonly string[], enabled: ReadonlySet<string>, levels: Record<string, number>): number {
  const sum = ids.reduce((total, id) => {
    const value = levels[id];
    return total + (enabled.has(id) ? Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1 : 0);
  }, 0);
  return 1 / Math.max(1, sum);
}
