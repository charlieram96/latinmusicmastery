'use client'

import { useEffect, useState } from 'react'

/** Keep partial typing separate from the tempo used by audio playback. */
export function BpmInput({ value, onChange, className }: {
  value: number
  onChange: (bpm: number) => void
  className?: string
}) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])
  const commit = () => {
    const parsed = Number(draft)
    const next = draft.trim() && Number.isFinite(parsed)
      ? Math.max(40, Math.min(200, Math.round(parsed))) : value
    setDraft(String(next))
    if (next !== value) onChange(next)
  }
  return <input aria-label="BPM" type="number" min={40} max={200} step={1}
    value={draft} onChange={event => setDraft(event.target.value)}
    onBlur={commit} onKeyDown={event => {
      if (event.key === 'Enter') { event.preventDefault(); commit() }
      if (event.key === 'Escape') setDraft(String(value))
    }} className={className} />
}
