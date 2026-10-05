'use client'

import { AdminText } from '@/components/admin/admin-text'


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
  instrument_ids: string[] | null
  style_ids: string[] | null
  expertise_level: string | null
}

interface NamedRecord {
  id: string
  name: string
}

interface Props {
  entries: WaitlistEntry[]
  instruments: NamedRecord[]
  styles: NamedRecord[]
}

type DialogState =
  | { open: false }
  | { open: true; mode: 'single'; ids: string[]; recipientCount: number; recipientPreview: string }
  | { open: true; mode: 'selected'; ids: string[]; recipientCount: number }
  | { open: true; mode: 'all'; recipientCount: number }

const EXPERTISE_LABEL: Record<string, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
}

const EXPERTISE_STYLES: Record<string, string> = {
  beginner: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20',
  intermediate: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20',
  advanced: 'bg-violet-500/10 text-violet-700 dark:text-violet-300 border-violet-500/20',
}

// Grid layout shared by header + each row, so columns line up.
const GRID_CLASSES =
  'grid grid-cols-[28px_minmax(220px,1.6fr)_minmax(160px,1.2fr)_minmax(160px,1.2fr)_120px_140px_36px] items-center gap-4 px-6'

export function WaitlistList({ entries, instruments, styles }: Props) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [dialog, setDialog] = useState<DialogState>({ open: false })
  const [flash, setFlash] = useState<string | null>(null)

  const instrumentMap = useMemo(
    () => new Map(instruments.map((i) => [i.id, i.name])),
    [instruments]
  )
  const styleMap = useMemo(
    () => new Map(styles.map((s) => [s.id, s.name])),
    [styles]
  )

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
          <h2 className="font-bold"><AdminText text={"Signups"} /></h2>
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
            <Send className="w-3.5 h-3.5" /> <AdminText text={"Send to selected ("} />{selected.size})
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
            <Send className="w-3.5 h-3.5" /> <AdminText text={"Send to all"} /> </Button>
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
        <div className="overflow-x-auto">
          <div className="min-w-[1080px]">
            <div
              className={`${GRID_CLASSES} py-2.5 border-b bg-muted/30 text-xs font-medium uppercase tracking-wider text-muted-foreground`}
            >
              <Checkbox
                checked={
                  allFilteredSelected
                    ? true
                    : someFilteredSelected
                      ? 'indeterminate'
                      : false
                }
                onCheckedChange={toggleAllFiltered}
                aria-label="Select all visible"
              />
              <span><AdminText text={"Email"} /></span>
              <span><AdminText text={"Instruments"} /></span>
              <span><AdminText text={"Genres"} /></span>
              <span><AdminText text={"Expertise"} /></span>
              <span><AdminText text={"Signed up"} /></span>
              <span className="sr-only"><AdminText text={"Actions"} /></span>
            </div>

            <div className="divide-y">
              {filtered.map((entry) => {
                const isSelected = selected.has(entry.id)
                const instrumentNames = (entry.instrument_ids ?? [])
                  .map((id) => instrumentMap.get(id))
                  .filter((n): n is string => Boolean(n))
                const styleNames = (entry.style_ids ?? [])
                  .map((id) => styleMap.get(id))
                  .filter((n): n is string => Boolean(n))

                return (
                  <div
                    key={entry.id}
                    className={`${GRID_CLASSES} py-3.5 hover:bg-accent/30 transition-colors`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleOne(entry.id)}
                      aria-label={`Select ${entry.email}`}
                    />

                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex-shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full bg-muted">
                        <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                      </div>
                      <span className="text-sm font-medium truncate">
                        {entry.email}
                      </span>
                    </div>

                    <PillList items={instrumentNames} />
                    <PillList items={styleNames} />

                    <ExpertiseBadge level={entry.expertise_level} />

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
          </div>
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

function PillList({ items }: { items: string[] }) {
  if (items.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((name) => (
        <span
          key={name}
          className="inline-flex items-center rounded-md border border-border bg-muted/40 px-2 py-0.5 text-xs text-foreground"
        >
          {name}
        </span>
      ))}
    </div>
  )
}

function ExpertiseBadge({ level }: { level: string | null }) {
  if (!level) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const label = EXPERTISE_LABEL[level] ?? level
  const cls = EXPERTISE_STYLES[level] ?? 'bg-muted text-muted-foreground border-border'
  return (
    <span
      className={`inline-flex w-fit items-center rounded-md border px-2 py-0.5 text-xs font-medium ${cls}`}
    >
      {label}
    </span>
  )
}
