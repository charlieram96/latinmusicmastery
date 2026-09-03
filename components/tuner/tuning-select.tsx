'use client'

import { useTranslation } from '@/components/language-provider'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Instrument } from '@/lib/tuner/instruments'

interface TuningSelectProps {
  instrument: Instrument
  value: string
  onChange: (tuningId: string) => void
}

/** Tuning dropdown. Renders nothing when the instrument has a single tuning. */
export function TuningSelect({ instrument, value, onChange }: TuningSelectProps) {
  const { t } = useTranslation()
  if (instrument.tunings.length < 2) return null
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-[34px] w-auto min-w-[180px] rounded-[9px] bg-raised text-[13px] font-medium" aria-label={t('dashboard.pages.tuner.strings.title')}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {instrument.tunings.map((tuning) => (
          <SelectItem key={tuning.id} value={tuning.id}>
            {t(`dashboard.pages.tuner.tunings.${tuning.nameKey}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
