'use client'

import { AudioLines, Guitar, Music2, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { TUNER_INSTRUMENTS, type InstrumentId } from '@/lib/tuner/instruments'

const ICONS: Record<InstrumentId, LucideIcon> = {
  guitar: Guitar,
  bass: Guitar,
  tres: Guitar,
  cuatro: Guitar,
  ukulele: Guitar,
  violin: Music2,
  chromatic: AudioLines,
}

interface InstrumentChipsProps {
  value: InstrumentId
  onChange: (id: InstrumentId) => void
}

export function InstrumentChips({ value, onChange }: InstrumentChipsProps) {
  const { t } = useTranslation()
  return (
    <div role="tablist" aria-label={t('dashboard.pages.tuner.title')} className="flex w-full gap-1.5 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible sm:pb-0">
      {TUNER_INSTRUMENTS.map((inst) => {
        const Icon = ICONS[inst.id]
        const selected = inst.id === value
        return (
          <button
            key={inst.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(inst.id)}
            className={cn(
              'inline-flex h-[34px] shrink-0 items-center gap-2 rounded-[9px] border px-3 text-[13px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              selected
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border bg-raised text-muted-foreground hover:border-foreground/20 hover:text-foreground'
            )}
          >
            <Icon className="h-[15px] w-[15px]" />
            {t(`dashboard.pages.tuner.instruments.${inst.nameKey}`)}
          </button>
        )
      })}
    </div>
  )
}
