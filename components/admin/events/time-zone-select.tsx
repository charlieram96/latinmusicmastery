'use client'

import { EVENT_TIME_ZONES } from '@/lib/tickets/format'
import { cn } from '@/lib/utils'

export const nativeSelectClass = 'h-9 w-full rounded-md border border-input bg-background px-3 text-sm'

/** Venue time zone; keeps a stored zone that is not in the common list. */
export function TimeZoneSelect({ id, value, onChange, className }: { id?: string; value: string; onChange: (tz: string) => void; className?: string }) {
  const zones: readonly string[] = EVENT_TIME_ZONES.includes(value as (typeof EVENT_TIME_ZONES)[number]) ? EVENT_TIME_ZONES : [value, ...EVENT_TIME_ZONES]
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={cn(nativeSelectClass, className)}>
      {zones.map((tz) => (
        <option key={tz} value={tz}>{tz.replace(/_/g, ' ')}</option>
      ))}
    </select>
  )
}
