'use client'

import { useMemo, useState } from 'react'
import { Mail, Search } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface WaitlistEntry {
  id: string
  email: string
  created_at: string | null
}

interface Props {
  entries: WaitlistEntry[]
}

export function WaitlistList({ entries }: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.email.toLowerCase().includes(q))
  }, [entries, query])

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4" />
          <h2 className="font-bold">Signups</h2>
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email"
            className="pl-8 h-9"
          />
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </span>
      </div>

      {filtered.length > 0 ? (
        <div className="divide-y">
          {filtered.map((entry) => (
            <div
              key={entry.id}
              className="flex items-center justify-between px-6 py-3.5"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                  <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <span className="text-sm font-medium truncate">{entry.email}</span>
              </div>
              <time className="text-xs text-muted-foreground whitespace-nowrap ml-4">
                {entry.created_at
                  ? new Date(entry.created_at).toLocaleString(undefined, {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })
                  : '—'}
              </time>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Mail className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">
            {entries.length === 0
              ? 'No waitlist signups yet.'
              : 'No signups match your search.'}
          </p>
        </div>
      )}
    </div>
  )
}
