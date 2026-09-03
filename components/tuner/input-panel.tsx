'use client'

import { AudioLines, Mic, MicOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useTunerFrame, type AudioDevice, type EngineErrorKind, type EngineStatus } from '@/hooks/use-tuner-engine'
import type { TunerStore } from '@/lib/tuner/tuner-store'

interface InputPanelProps {
  status: EngineStatus
  errorKind: EngineErrorKind | null
  devices: AudioDevice[]
  deviceId: string | null
  deviceLabel: string
  onDeviceChange: (id: string) => void
  onRetry: () => void
  store: TunerStore
}

const ERROR_KEY: Record<EngineErrorKind, string> = {
  denied: 'denied',
  notfound: 'notFound',
  busy: 'busy',
  unsupported: 'unsupported',
  unknown: 'unknown',
}

const BAR_HEIGHTS = [6, 8, 10, 12, 14, 16, 18, 20, 22, 22]

export function InputPanel({ status, errorKind, devices, deviceId, deviceLabel, onDeviceChange, onRetry, store }: InputPanelProps) {
  const { t } = useTranslation()
  const { level, clip } = useTunerFrame(store)
  const live = status === 'listening'
  const error = status === 'error'
  const lit = Math.round(level * BAR_HEIGHTS.length)

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-[auto_1fr]">
      <div className="flex min-h-[54px] items-center gap-2.5 rounded-[11px] border border-border bg-sunken px-3 py-2.5">
        <span className="text-xs text-muted-foreground">{t('dashboard.pages.tuner.input.label')}</span>
        <Select value={deviceId ?? '__default'} onValueChange={onDeviceChange} disabled={devices.length === 0}>
          <SelectTrigger className="h-8 w-auto min-w-[160px] rounded-lg bg-raised text-[13px] font-medium" aria-label={t('dashboard.pages.tuner.input.label')}>
            <SelectValue placeholder={t('dashboard.pages.tuner.input.defaultDevice')} />
          </SelectTrigger>
          <SelectContent>
            {devices.length === 0 && <SelectItem value="__default">{t('dashboard.pages.tuner.input.defaultDevice')}</SelectItem>}
            {devices.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3 rounded-[11px] border border-border bg-sunken px-3.5 py-2.5">
        <div
          className={cn(
            'grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg',
            live ? 'bg-success/15 text-success' : error ? 'bg-terracotta/15 text-terracotta' : 'bg-raised text-muted-foreground'
          )}
        >
          {live ? <Mic className="h-4 w-4" /> : error ? <MicOff className="h-4 w-4" /> : <AudioLines className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-semibold">
            {live
              ? t('dashboard.pages.tuner.input.on')
              : error
                ? t('dashboard.pages.tuner.input.unavailable')
                : t('dashboard.pages.tuner.input.off')}
          </div>
          <div className="text-xs text-muted-foreground">
            {live
              ? t('dashboard.pages.tuner.input.onHelp', { device: deviceLabel || t('dashboard.pages.tuner.input.defaultDevice') })
              : error && errorKind
                ? t(`dashboard.pages.tuner.errors.${ERROR_KEY[errorKind]}`)
                : t('dashboard.pages.tuner.input.offHelp')}
          </div>
        </div>
        {error ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t('dashboard.pages.tuner.errors.tryAgain')}
          </Button>
        ) : (
          <div className="flex h-[22px] items-end gap-[3px]" aria-hidden>
            {BAR_HEIGHTS.map((h, i) => {
              const hot = i >= BAR_HEIGHTS.length - 3
              const on = clip || i < lit
              return (
                <span
                  key={i}
                  className={cn('block w-[5px] rounded-sm transition-colors duration-75', on ? (hot || clip ? 'bg-terracotta' : 'bg-success') : 'bg-foreground/15')}
                  style={{ height: h }}
                />
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
