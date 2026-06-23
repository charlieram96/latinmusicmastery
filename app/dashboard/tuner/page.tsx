'use client'

import { useState } from 'react'
import { AudioWaveform, AlertTriangle, Guitar, Piano, Music2, Music } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { usePitchDetection } from '@/hooks/use-pitch-detection'
import { useTranslation } from '@/components/language-provider'
import { TUNER_INSTRUMENTS, type TunerInstrument } from '@/lib/tuner/tuner-utils'
import { StrobeMeter } from '@/components/tuner/strobe-meter'
import { NoteReadout } from '@/components/tuner/note-readout'
import { StringPads } from '@/components/tuner/string-pads'
import { SignalWaveform } from '@/components/tuner/signal-waveform'
import { TunerSettings, SENSITIVITY_PRESETS, type Sensitivity } from '@/components/tuner/tuner-settings'
import { TunerExplainer } from '@/components/tuner/tuner-explainer'

const INSTRUMENT_ICONS: Record<TunerInstrument, typeof Guitar> = {
  Guitar,
  Bass: Guitar,
  Piano,
  Violin: Music2,
  Tres: Music,
}

export default function TunerPage() {
  const { t } = useTranslation()
  const [referencePitch, setReferencePitch] = useState(440)
  const [instrument, setInstrument] = useState<TunerInstrument>('Guitar')
  const [sensitivity, setSensitivity] = useState<Sensitivity>('medium')

  const preset = SENSITIVITY_PRESETS[sensitivity]
  const {
    frequency,
    note,
    octave,
    cents,
    level,
    isListening,
    hasPermission,
    error,
    getAnalyser,
    startListening,
    stopListening,
  } = usePitchDetection({
    referencePitch,
    silenceThreshold: preset.silenceThreshold,
    clarityThreshold: preset.clarityThreshold,
  })

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col gap-6 pb-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div>
          <h1 className="font-heading text-2xl font-bold tracking-tight">
            {t('dashboard.pages.tuner.title')}
          </h1>
          <p className="text-sm text-muted-foreground">{t('dashboard.pages.tuner.subtitle')}</p>
        </div>
        <Badge variant="secondary" className="ml-auto hidden sm:flex">
          <AudioWaveform className="h-3 w-3" />
          {t('dashboard.pages.tuner.chromatic')}
        </Badge>
      </div>

      <div className="grid flex-1 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_clamp(320px,26vw,400px)]">
        {/* ── Main panel ── */}
        <div className="flex flex-col gap-6 rounded-2xl border border-border bg-card/40 p-5 sm:p-8">
          {/* Instrument selector */}
          <div className="flex flex-wrap gap-2">
            {TUNER_INSTRUMENTS.map((inst) => {
              const Icon = INSTRUMENT_ICONS[inst]
              const selected = instrument === inst
              return (
                <button
                  key={inst}
                  type="button"
                  onClick={() => setInstrument(inst)}
                  className={cn(
                    'flex flex-1 items-center justify-center gap-2 rounded-xl border px-3.5 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
                    selected
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border bg-card/60 text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(`dashboard.pages.tuner.instruments.${inst.toLowerCase()}.name`)}
                </button>
              )
            })}
          </div>

          {/* Meter + readout — fills the panel, vertically centered */}
          <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-10 py-2">
            <StrobeMeter cents={cents} isListening={isListening} />
            <NoteReadout
              note={note}
              octave={octave}
              frequency={frequency}
              cents={cents}
              isListening={isListening}
              referencePitch={referencePitch}
            />
          </div>

          {/* String pads — anchored to the bottom */}
          <StringPads
            instrument={instrument}
            frequency={frequency}
            isListening={isListening}
            referencePitch={referencePitch}
          />
        </div>

        {/* ── Right rail ── */}
        <div className="flex flex-col gap-5">
          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <SignalWaveform
              getAnalyser={getAnalyser}
              level={level}
              isListening={isListening}
              onStart={startListening}
              onStop={stopListening}
            />
          </div>

          <div className="rounded-2xl border border-border bg-card/40 p-5">
            <TunerSettings
              referencePitch={referencePitch}
              onReferencePitchChange={setReferencePitch}
              sensitivity={sensitivity}
              onSensitivityChange={setSensitivity}
            />
          </div>

          <div className="flex-1 rounded-2xl border border-border bg-card/40 p-5">
            <TunerExplainer />
          </div>
        </div>
      </div>

      {/* Permission / error */}
      {(hasPermission === false || error) && (
        <div className="flex items-start gap-3 rounded-xl border border-destructive/50 bg-destructive/5 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-destructive">
              {hasPermission === false
                ? t('dashboard.pages.tuner.micAccessDenied')
                : t('dashboard.pages.tuner.micError')}
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              {error || t('dashboard.pages.tuner.micAccessHelp')}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={startListening}>
              {t('dashboard.pages.tuner.tryAgain')}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
