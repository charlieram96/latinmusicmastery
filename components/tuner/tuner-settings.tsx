'use client'

import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type Sensitivity = 'low' | 'medium' | 'high'

interface TunerSettingsProps {
  referencePitch: number
  onReferencePitchChange: (value: number) => void
  sensitivity: Sensitivity
  onSensitivityChange: (value: Sensitivity) => void
}

const REFERENCE_PITCHES = [432, 434, 436, 438, 440, 441, 442, 443, 444]
const SENSITIVITIES: Sensitivity[] = ['low', 'medium', 'high']

/** Map a sensitivity level to the engine's silence + clarity thresholds. */
export const SENSITIVITY_PRESETS: Record<Sensitivity, { silenceThreshold: number; clarityThreshold: number }> = {
  low: { silenceThreshold: 0.02, clarityThreshold: 0.9 },
  medium: { silenceThreshold: 0.01, clarityThreshold: 0.8 },
  high: { silenceThreshold: 0.004, clarityThreshold: 0.7 },
}

export function TunerSettings({
  referencePitch,
  onReferencePitchChange,
  sensitivity,
  onSensitivityChange,
}: TunerSettingsProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-col gap-5">
      <span className="text-[11px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {t('dashboard.pages.tuner.settings.title')}
      </span>

      {/* Reference pitch */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">{t('dashboard.pages.tuner.settings.reference')}</label>
          <Select
            value={referencePitch.toString()}
            onValueChange={(v) => onReferencePitchChange(Number(v))}
          >
            <SelectTrigger className="h-8 w-[104px] font-mono text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {REFERENCE_PITCHES.map((p) => (
                <SelectItem key={p} value={p.toString()} className="font-mono">
                  {p} Hz
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground">{t('dashboard.pages.tuner.settings.referenceHelp')}</p>
      </div>

      {/* Sensitivity */}
      <div className="flex flex-col gap-1.5">
        <label className="text-sm font-medium">{t('dashboard.pages.tuner.settings.sensitivity')}</label>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-border bg-card/60 p-1">
          {SENSITIVITIES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onSensitivityChange(s)}
              className={cn(
                'rounded-md px-2 py-1.5 text-sm font-medium capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                sensitivity === s
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:bg-muted/50'
              )}
            >
              {t(`dashboard.pages.tuner.settings.sensitivityLevels.${s}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t('dashboard.pages.tuner.settings.sensitivityHelp')}</p>
      </div>
    </div>
  )
}
