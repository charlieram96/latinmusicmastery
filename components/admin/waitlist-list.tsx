'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Mail, Search, Send } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { SendEmailDialog } from '@/components/admin/send-email-dialog'

interface WaitlistEntry {
  id: string
  email: string
  created_at: string | null
}

interface Props {
  entries: WaitlistEntry[]
}

type DialogState =
  | { open: false }
  | { open: true; mode: 'single'; ids: string[]; recipientCount: number; recipientPreview: string }
  | { open: true; mode: 'selected'; ids: string[]; recipientCount: number }
  | { open: true; mode: 'all'; recipientCount: number }

export function WaitlistList({ entries }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<DialogState>({ open: false })
  const [flash, setFlash] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return entries
    return entries.filter((e) => e.email.toLowerCase().includes(q))
  }, [entries, query])

  const filteredIds = useMemo(() => filtered.map((e) => e.id), [filtered])
  const allFilteredSelected =
    filteredIds.length > 0 && filteredIds.every((id) => selected.has(id))
  const someFilteredSelected =
    !allFilteredSelected && filteredIds.some((id) => selected.has(id))

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAllFiltered = () => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (allFilteredSelected) {
        for (const id of filteredIds) next.delete(id)
      } else {
        for (const id of filteredIds) next.add(id)
      }
      return next
    })
  }

  const handleSent = (count: number) => {
    setFlash(`Sent to ${count} ${count === 1 ? 'person' : 'people'}.`)
    setSelected(new Set())
    window.setTimeout(() => setFlash(null), 4000)
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b">
        <div className="flex items-center gap-2">
          <Mail className="w-4 h-4" />
          <h2 className="font-bold">Signups</h2>
        </div>
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by email"
            className="pl-8 h-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={selected.size === 0}
            onClick={() =>
              setDialog({
                open: true,
                mode: 'selected',
                ids: Array.from(selected),
                recipientCount: selected.size,
              })
            }
          >
            <Send className="w-3.5 h-3.5" />
            Send to selected ({selected.size})
          </Button>
          <Button
            size="sm"
            disabled={entries.length === 0}
            onClick={() =>
              setDialog({
                open: true,
                mode: 'all',
                recipientCount: entries.length,
              })
            }
          >
            <Send className="w-3.5 h-3.5" />
            Send to all
          </Button>
        </div>
        <span className="text-sm text-muted-foreground whitespace-nowrap">
          {filtered.length} {filtered.length === 1 ? 'result' : 'results'}
        </span>
      </div>

      <AnimatePresence>
        {flash && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="px-6 py-2.5 text-sm bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-b border-emerald-500/20"
          >
            {flash}
          </motion.div>
        )}
      </AnimatePresence>

      {filtered.length > 0 ? (
        <>
          <div className="flex items-center gap-3 px-6 py-2.5 border-b bg-muted/30 text-xs text-muted-foreground">
            <Checkbox
              checked={
                allFilteredSelected ? true : someFilteredSelected ? 'indeterminate' : false
              }
              onCheckedChange={toggleAllFiltered}
              aria-label="Select all visible"
            />
            <span>
              {selected.size > 0
                ? `${selected.size} selected`
                : 'Select all visible'}
            </span>
          </div>
          <div className="divide-y">
            {filtered.map((entry) => {
              const isSelected = selected.has(entry.id)
              return (
                <div
                  key={entry.id}
                  className="flex items-center justify-between gap-3 px-6 py-3.5"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(entry.id)}
                      aria-label={`Select ${entry.email}`}
                    />
                    <div className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                      <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                    <span className="text-sm font-medium truncate">{entry.email}</span>
                  </div>
                  <time className="text-xs text-muted-foreground whitespace-nowrap">
                    {entry.created_at
                      ? new Date(entry.created_at).toLocaleString(undefined, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        })
                      : '—'}
                  </time>
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Send email to ${entry.email}`}
                    onClick={() =>
                      setDialog({
                        open: true,
                        mode: 'single',
                        ids: [entry.id],
                        recipientCount: 1,
                        recipientPreview: entry.email,
                      })
                    }
                  >
                    <Send className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )
            })}
          </div>
        </>
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

      <SendEmailDialog
        open={dialog.open}
        onOpenChange={(open) => {
          if (!open) setDialog({ open: false })
        }}
        mode={dialog.open ? dialog.mode : 'all'}
        ids={dialog.open && dialog.mode !== 'all' ? dialog.ids : undefined}
        recipientCount={dialog.open ? dialog.recipientCount : 0}
        recipientPreview={
          dialog.open && dialog.mode === 'single' ? dialog.recipientPreview : undefined
        }
        onSent={handleSent}
      />
    </div>
  )
}
