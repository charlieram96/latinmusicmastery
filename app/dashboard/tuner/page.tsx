'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mic,
  MicOff,
  AudioWaveform,
  Check,
  ChevronUp,
  ChevronDown,
  ChevronsUp,
  ChevronsDown,
  AlertTriangle,
  Guitar,
  Piano,
  Music2,
  Music,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePitchDetection } from '@/hooks/use-pitch-detection'
import { staggerContainer, staggerChild } from '@/lib/animation-variants'
import { useTranslation } from '@/components/language-provider'

const REFERENCE_PITCHES = [432, 434, 436, 438, 440, 441, 442, 443, 444]

const TUNABLE_INSTRUMENTS = ['Guitar', 'Bass', 'Piano', 'Violin', 'Tres'] as const

const INSTRUMENT_ICONS: Record<string, typeof Guitar> = {
  Guitar: Guitar,
  Bass: Guitar,
  Piano: Piano,
  Violin: Music2,
  Tres: Music,
}

const INSTRUMENT_TUNING_INFO: Record<string, { description: string; strings?: string[] }> = {
  Guitar: {
    description: 'Play each open string and tune to match.',
    strings: ['E2', 'A2', 'D3', 'G3', 'B3', 'E4'],
  },
  Bass: {
    description: 'Play each open string and tune to match.',
    strings: ['E1', 'A1', 'D2', 'G2'],
  },
  Piano: {
    description: 'Play individual keys and compare to the target pitch. Use for spot-checking after a full tuning.',
  },
  Violin: {
    description: 'Tune each string by bowing or plucking gently.',
    strings: ['G3', 'D4', 'A4', 'E5'],
  },
  Tres: {
    description: 'Tune each course (doubled strings) to match.',
    strings: ['G4', 'C4', 'E4'],
  },
}

// Arc gauge constants — larger gauge
const CX = 250
const CY = 220
const R = 190

function getTuningStatus(cents: number | null, t: (key: string) => string) {
  if (cents === null) return { label: t('dashboard.pages.tuner.status.waiting'), icon: AudioWaveform, color: 'text-muted-foreground' }
  const absCents = Math.abs(cents)
  if (absCents < 5) return { label: t('dashboard.pages.tuner.status.inTune'), icon: Check, color: 'text-green-500' }
  if (cents > 0) {
    if (absCents > 20) return { label: t('dashboard.pages.tuner.status.sharp'), icon: ChevronsUp, color: 'text-red-500' }
    return { label: t('dashboard.pages.tuner.status.slightlySharp'), icon: ChevronUp, color: 'text-yellow-500' }
  }
  if (absCents > 20) return { label: t('dashboard.pages.tuner.status.flat'), icon: ChevronsDown, color: 'text-red-500' }
  return { label: t('dashboard.pages.tuner.status.slightlyFlat'), icon: ChevronDown, color: 'text-yellow-500' }
}

function getNoteColor(cents: number | null) {
  if (cents === null) return 'text-muted-foreground'
  const absCents = Math.abs(cents)
  if (absCents < 5) return 'text-green-500'
  if (absCents <= 20) return 'text-yellow-500'
  return 'text-red-500'
}

/** Convert cents (-50..+50) to arc angle in degrees (180..0, left-to-right) */
function centsToAngle(cents: number): number {
  return 180 - ((cents + 50) / 100) * 180
}

/** Convert polar angle (degrees) to cartesian coords on the arc */
function polarToCartesian(angleDeg: number, radius = R): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CX + radius * Math.cos(rad), y: CY - radius * Math.sin(rad) }
}

/** Build an SVG arc path between two cent values */
function arcPath(startCents: number, endCents: number, radius = R): string {
  const a1 = centsToAngle(startCents)
  const a2 = centsToAngle(endCents)
  const start = polarToCartesian(a1, radius)
  const end = polarToCartesian(a2, radius)
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 0 1 ${end.x} ${end.y}`
}

/** Generate tick mark endpoints */
function tickMark(cents: number, inner: number, outer: number) {
  const angle = centsToAngle(cents)
  const rad = (angle * Math.PI) / 180
  return {
    x1: CX + inner * Math.cos(rad),
    y1: CY - inner * Math.sin(rad),
    x2: CX + outer * Math.cos(rad),
    y2: CY - outer * Math.sin(rad),
  }
}

const ARC_SEGMENTS: { start: number; end: number; id: string }[] = [
  { start: -50, end: -20, id: 'red-left' },
  { start: -20, end: -5, id: 'yellow-left' },
  { start: -5, end: 5, id: 'green-center' },
  { start: 5, end: 20, id: 'yellow-right' },
  { start: 20, end: 50, id: 'red-right' },
]

// 11 ticks at every 10 cents
const TICKS = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50]
const TICK_LABELS: Record<number, string> = { '-50': '-50', '-25': '-25', 0: '0', 25: '+25', 50: '+50' }
const LABELED_TICKS = [-50, -25, 0, 25, 50]

const pulseVariants = {
  initial: { scale: 1, opacity: 0.3 },
  animate: {
    scale: [1, 1.6, 1],
    opacity: [0.3, 0, 0.3],
    transition: {
      duration: 1.5,
      ease: 'easeInOut' as const,
      repeat: Infinity,
    },
  },
}

export default function TunerPage() {
  const { t } = useTranslation()
  const [referencePitch, setReferencePitch] = useState(440)
  const [selectedInstrument, setSelectedInstrument] = useState('Guitar')
  const {
    frequency,
    note,
    octave,
    cents,
    isListening,
    hasPermission,
    error,
    startListening,
    stopListening,
  } = usePitchDetection({ referencePitch })

  const tuningStatus = getTuningStatus(cents, t)
  const StatusIcon = tuningStatus.icon
  const noteColor = getNoteColor(cents)

  const instrumentInfo: Record<string, { description: string; strings?: string[] }> = {
    Guitar: {
      description: t('dashboard.pages.tuner.instruments.guitar.description'),
      strings: INSTRUMENT_TUNING_INFO.Guitar.strings,
    },
    Bass: {
      description: t('dashboard.pages.tuner.instruments.bass.description'),
      strings: INSTRUMENT_TUNING_INFO.Bass.strings,
    },
    Piano: {
      description: t('dashboard.pages.tuner.instruments.piano.description'),
    },
    Violin: {
      description: t('dashboard.pages.tuner.instruments.violin.description'),
      strings: INSTRUMENT_TUNING_INFO.Violin.strings,
    },
    Tres: {
      description: t('dashboard.pages.tuner.instruments.tres.description'),
      strings: INSTRUMENT_TUNING_INFO.Tres.strings,
    },
  }
  const currentInfo = instrumentInfo[selectedInstrument]

  // Needle angle for the tapered polygon
  const needleAngleDeg = centsToAngle(cents ?? 0)
  const isInTune = cents !== null && Math.abs(cents) < 5

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem-3rem)]">
      {/* Compact header */}
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">{t('dashboard.pages.tuner.title')}</h1>
        <Badge variant="secondary" className="hidden sm:flex">
          <AudioWaveform className="h-3 w-3" />
          {t('dashboard.pages.tuner.chromatic')}
        </Badge>
      </div>

      {/* Two-column body */}
      <div className="flex flex-col md:flex-row gap-6 flex-1 min-h-0">
        {/* ── Left Column ── */}
        <div className="w-full md:w-[280px] flex flex-col gap-4 shrink-0">
          {/* Instrument cards — horizontal scroll on mobile, vertical on desktop */}
          <motion.div
            className="flex md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0"
            variants={staggerContainer(0.08, 0.05)}
            initial="hidden"
            animate="visible"
          >
            {TUNABLE_INSTRUMENTS.map((inst) => {
              const Icon = INSTRUMENT_ICONS[inst]
              const isSelected = selectedInstrument === inst
              return (
                <motion.button
                  key={inst}
                  variants={staggerChild}
                  onClick={() => setSelectedInstrument(inst)}
                  className={cn(
                    'flex items-center gap-3 px-4 py-3 rounded-xl border transition-colors whitespace-nowrap shrink-0',
                    'text-sm font-medium cursor-pointer',
                    isSelected
                      ? 'bg-primary/10 border-primary text-primary'
                      : 'bg-card border-border text-muted-foreground hover:bg-muted/50'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {inst}
                </motion.button>
              )
            })}
          </motion.div>

          {/* Instrument info */}
          {currentInfo && (
            <div className="rounded-xl bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">{selectedInstrument}</span>
                {' \u2014 '}
                {currentInfo.description}
              </p>
              {currentInfo.strings && (
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  {currentInfo.strings.map((s) => (
                    <Badge key={s} variant="outline" className="text-xs font-mono">
                      {s}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Reference pitch — pushed to bottom on desktop */}
          <div className="mt-auto flex items-center gap-2">
            <label className="text-sm text-muted-foreground whitespace-nowrap">A4 =</label>
            <Select
              value={referencePitch.toString()}
              onValueChange={(val) => setReferencePitch(Number(val))}
            >
              <SelectTrigger className="w-[100px] h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {REFERENCE_PITCHES.map((pitch) => (
                  <SelectItem key={pitch} value={pitch.toString()}>
                    {pitch} Hz
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* ── Right Column ── */}
        <div className="flex-1 flex flex-col items-center justify-center min-h-0">
          {/* SVG Gauge */}
          <div className="w-full max-w-lg">
            <svg
              viewBox="0 0 500 260"
              className="w-full"
              aria-label="Tuning gauge"
            >
              <defs>
                {/* Gradient: red left */}
                <linearGradient id="grad-red-left" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#dc2626" />
                  <stop offset="100%" stopColor="#ef4444" />
                </linearGradient>
                {/* Gradient: yellow left */}
                <linearGradient id="grad-yellow-left" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" stopOpacity="0.8" />
                  <stop offset="100%" stopColor="#eab308" />
                </linearGradient>
                {/* Gradient: green center */}
                <linearGradient id="grad-green-center" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#4ade80" />
                  <stop offset="100%" stopColor="#22c55e" stopOpacity="0.9" />
                </linearGradient>
                {/* Gradient: yellow right */}
                <linearGradient id="grad-yellow-right" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#eab308" />
                  <stop offset="100%" stopColor="#ef4444" stopOpacity="0.8" />
                </linearGradient>
                {/* Gradient: red right */}
                <linearGradient id="grad-red-right" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#ef4444" />
                  <stop offset="100%" stopColor="#dc2626" />
                </linearGradient>
                {/* Glow filter for in-tune */}
                <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="6" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                {/* Drop shadow for needle */}
                <filter id="needle-shadow" x="-50%" y="-50%" width="200%" height="200%">
                  <feDropShadow dx="1" dy="1" stdDeviation="2" floodOpacity="0.3" />
                </filter>
              </defs>

              {/* Background track */}
              <path
                d={arcPath(-50, 50)}
                fill="none"
                stroke="hsl(var(--muted))"
                strokeWidth={28}
                strokeLinecap="round"
                opacity={0.5}
              />

              {/* Colored arc segments */}
              {ARC_SEGMENTS.map((seg) => (
                <path
                  key={seg.id}
                  d={arcPath(seg.start, seg.end)}
                  fill="none"
                  stroke={`url(#grad-${seg.id})`}
                  strokeWidth={24}
                  strokeLinecap="round"
                  opacity={0.85}
                  filter={seg.id === 'green-center' && isInTune ? 'url(#glow)' : undefined}
                />
              ))}

              {/* Tick marks — 11 ticks */}
              {TICKS.map((t) => {
                const tick = tickMark(t, R - 20, R + 20)
                const isCenter = t === 0
                const isMajor = t % 25 === 0 || t === 0
                return (
                  <line
                    key={t}
                    x1={tick.x1}
                    y1={tick.y1}
                    x2={tick.x2}
                    y2={tick.y2}
                    stroke="hsl(var(--muted-foreground))"
                    strokeWidth={isCenter ? 3 : isMajor ? 2 : 1.2}
                    opacity={isCenter ? 1 : isMajor ? 0.7 : 0.35}
                  />
                )
              })}

              {/* Cent labels outside arc */}
              {LABELED_TICKS.map((t) => {
                const pos = polarToCartesian(centsToAngle(t), R + 38)
                return (
                  <text
                    key={`label-${t}`}
                    x={pos.x}
                    y={pos.y}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    fontSize={11}
                    fill="hsl(var(--muted-foreground))"
                    opacity={0.7}
                  >
                    {TICK_LABELS[t] ?? t}
                  </text>
                )
              })}

              {/* Tapered needle */}
              <motion.g
                animate={{ rotate: -(needleAngleDeg - 90) }}
                transition={{ type: 'spring', stiffness: 80, damping: 28 }}
                style={{ transformOrigin: `${CX}px ${CY}px` }}
                filter="url(#needle-shadow)"
              >
                <polygon
                  points={`${CX},${CY - R + 28} ${CX - 5},${CY} ${CX + 5},${CY}`}
                  fill="hsl(var(--foreground))"
                />
              </motion.g>

              {/* Pivot circle */}
              <circle cx={CX} cy={CY} r={8} fill="hsl(var(--foreground))" />
              <circle cx={CX} cy={CY} r={4} fill="hsl(var(--background))" />
            </svg>

            {/* Flat / Sharp labels — HTML, not SVG */}
            <div className="flex justify-between px-8 -mt-2">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{t('dashboard.pages.tuner.flat')}</span>
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{t('dashboard.pages.tuner.sharp')}</span>
            </div>
          </div>

          {/* Note display */}
          <div className="flex flex-col items-center gap-1 mt-4">
            <AnimatePresence mode="wait">
              <motion.div
                key={`${note ?? '--'}${octave ?? ''}`}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                className={cn('text-6xl sm:text-8xl font-bold font-mono transition-colors', noteColor)}
              >
                {note && octave !== null ? `${note}${octave}` : '--'}
              </motion.div>
            </AnimatePresence>

            <div className="text-lg font-mono text-muted-foreground">
              {frequency !== null ? `${frequency.toFixed(1)} Hz` : '-- Hz'}
            </div>

            <div className={cn('flex items-center gap-1.5 text-sm font-medium mt-1', tuningStatus.color)}>
              <StatusIcon className="h-4 w-4" />
              {tuningStatus.label}
            </div>
          </div>

          {/* Mic button */}
          <div className="flex justify-center mt-6">
            <div className="relative">
              {isListening && (
                <motion.span
                  className="absolute inset-0 rounded-full bg-destructive/30"
                  variants={pulseVariants}
                  initial="initial"
                  animate="animate"
                />
              )}
              <Button
                variant={isListening ? 'destructive' : 'default'}
                className="rounded-full h-20 w-20 relative shadow-lg"
                onClick={isListening ? stopListening : startListening}
                aria-label={isListening ? t('dashboard.pages.tuner.stopTuner') : t('dashboard.pages.tuner.startTuner')}
              >
                {isListening ? (
                  <MicOff className="h-7 w-7" />
                ) : (
                  <Mic className="h-7 w-7" />
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Error cards — full width below layout */}
      {hasPermission === false && (
        <Card className="p-6 border-destructive/50 bg-destructive/5 mt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-destructive">
                {t('dashboard.pages.tuner.micAccessDenied')}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {error || t('dashboard.pages.tuner.micAccessHelp')}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={startListening}
              >
                {t('dashboard.pages.tuner.tryAgain')}
              </Button>
            </div>
          </div>
        </Card>
      )}

      {error && hasPermission !== false && (
        <Card className="p-6 border-destructive/50 bg-destructive/5 mt-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={startListening}
              >
                {t('dashboard.pages.tuner.tryAgain')}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
