/** Two-letter initials from a display name, falling back to the email's local part. */
export function initialsFor(name?: string | null, email?: string | null): string {
  const source = (name || '').trim() || (email || '').split('@')[0]
  if (!source) return 'U'
  const parts = source.split(/[\s._-]+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? parts[parts.length - 1][0] : parts[0]?.[1] ?? ''
  return (first + second).toUpperCase()
}
