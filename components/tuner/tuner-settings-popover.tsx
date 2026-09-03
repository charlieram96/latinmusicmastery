'use client'

import { SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import type { TunerPrefs } from '@/lib/tuner/prefs'

interface TunerSettingsPopoverProps {
  prefs: TunerPrefs
  onChange: (patch: Partial<TunerPrefs>) => void
}

interface Option<V> {
  value: V
  label: string
}

function Segment<V extends string | number>({ value, options, onChange }: { value: V; options: Option<V>[]; onChange: (v: V) => void }) {
  return (
    <div className="inline-flex shrink-0 gap-0.5 rounded-[7px] border border-border p-0.5" role="group">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
          className={cn(
            'whitespace-nowrap rounded-[5px] px-2 py-1 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            o.value === value ? 'bg-raised text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function TunerSettingsPopover({ prefs, onChange }: TunerSettingsPopoverProps) {
  const { t } = useTranslation()
  const k = (key: string) => t(`dashboard.pages.tuner.settings.${key}`)
  const rowClass = 'flex items-center justify-between gap-3 border-t border-border py-2 text-[13px] first:border-t-0'

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={k('open')}
          className="grid h-[34px] w-[34px] place-items-center rounded-[9px] border border-border bg-raised text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 data-[state=open]:border-primary data-[state=open]:text-primary"
        >
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[300px] p-4">
        <h3 className="mb-2 font-heading text-[12px] font-bold uppercase tracking-[0.12em] text-gold">{k('title')}</h3>
        <div className={rowClass}>
          <div>
            {k('sensitivity')}
            <span className="block text-[11px] text-muted-foreground">{k('sensitivityHelp')}</span>
          </div>
          <Segment
            value={prefs.sensitivity}
            onChange={(sensitivity) => onChange({ sensitivity })}
            options={[
              { value: 'low', label: k('low') },
              { value: 'med', label: k('med') },
              { value: 'high', label: k('high') },
            ]}
          />
        </div>
        <div className={rowClass}>
          <div>
            {k('window')}
            <span className="block text-[11px] text-muted-foreground">{k('windowHelp')}</span>
          </div>
          <Segment
            value={prefs.tolerance}
            onChange={(tolerance) => onChange({ tolerance })}
            options={[
              { value: 1, label: '±1¢' },
              { value: 3, label: '±3¢' },
              { value: 5, label: '±5¢' },
            ]}
          />
        </div>
        <div className={rowClass}>
          <div>
            {k('names')}
            <span className="block text-[11px] text-muted-foreground">{k('namesHelp')}</span>
          </div>
          <Segment
            value={prefs.names}
            onChange={(names) => onChange({ names })}
            options={[
              { value: 'letters', label: k('letters') },
              { value: 'solfege', label: k('solfege') },
            ]}
          />
        </div>
        <div className={rowClass}>
          <div>
            {k('transpose')}
            <span className="block text-[11px] text-muted-foreground">{k('transposeHelp')}</span>
          </div>
          <Segment
            value={prefs.transpose}
            onChange={(transpose) => onChange({ transpose })}
            options={[
              { value: 0, label: k('concert') },
              { value: 2, label: 'B♭' },
              { value: 9, label: 'E♭' },
              { value: 7, label: 'F' },
            ]}
          />
        </div>
        <div className={rowClass}>
          <div>
            {k('hold')}
            <span className="block text-[11px] text-muted-foreground">{k('holdHelp')}</span>
          </div>
          <Segment
            value={prefs.holdSec}
            onChange={(holdSec) => onChange({ holdSec })}
            options={[
              { value: 0, label: k('off') },
              { value: 1, label: '1s' },
              { value: 2, label: '2s' },
            ]}
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}
