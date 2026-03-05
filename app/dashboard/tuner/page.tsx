'use client'

import { useState } from 'react'
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
  Music,
} from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { usePitchDetection } from '@/hooks/use-pitch-detection'

const REFERENCE_PITCHES = [432, 434, 436, 438, 440, 441, 442, 443, 444]

const TUNABLE_INSTRUMENTS = ['Guitar', 'Bass', 'Piano', 'Violin', 'Tres'] as const

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

// Arc gauge constants
const CX = 170
const CY = 160
const R = 130

function getTuningStatus(cents: number | null) {
  if (cents === null) return { label: 'Waiting...', icon: AudioWaveform, color: 'text-muted-foreground' }
  const absCents = Math.abs(cents)
  if (absCents < 5) return { label: 'In Tune', icon: Check, color: 'text-green-500' }
  if (cents > 0) {
    if (absCents > 20) return { label: 'Sharp', icon: ChevronsUp, color: 'text-red-500' }
    return { label: 'Slightly Sharp', icon: ChevronUp, color: 'text-yellow-500' }
  }
  if (absCents > 20) return { label: 'Flat', icon: ChevronsDown, color: 'text-red-500' }
  return { label: 'Slightly Flat', icon: ChevronDown, color: 'text-yellow-500' }
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
function polarToCartesian(angleDeg: number): { x: number; y: number } {
  const rad = (angleDeg * Math.PI) / 180
  return { x: CX + R * Math.cos(rad), y: CY - R * Math.sin(rad) }
}

/** Build an SVG arc path between two cent values */
function arcPath(startCents: number, endCents: number): string {
  const a1 = centsToAngle(startCents)
  const a2 = centsToAngle(endCents)
  const start = polarToCartesian(a1)
  const end = polarToCartesian(a2)
  // arc sweeps clockwise (large-arc=0 since each segment < 180°)
  return `M ${start.x} ${start.y} A ${R} ${R} 0 0 1 ${end.x} ${end.y}`
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

const ARC_SEGMENTS: { start: number; end: number; color: string }[] = [
  { start: -50, end: -20, color: '#ef4444' },
  { start: -20, end: -5, color: '#eab308' },
  { start: -5, end: 5, color: '#22c55e' },
  { start: 5, end: 20, color: '#eab308' },
  { start: 20, end: 50, color: '#ef4444' },
]

const TICKS = [-50, -25, 0, 25, 50]

export default function TunerPage() {
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

  const tuningStatus = getTuningStatus(cents)
  const StatusIcon = tuningStatus.icon
  const noteColor = getNoteColor(cents)

  // Needle rotation: 0° = straight up (center), ±90° = edges
  const needleRotation = cents !== null ? (cents / 50) * 90 : 0

  // Needle tip position for the SVG line
  const needleAngle = centsToAngle(cents ?? 0)
  const needleTip = polarToCartesian(needleAngle)

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Instrument Tuner</h1>
        <p className="text-muted-foreground mt-1">
          Tune your instrument using your device&apos;s microphone
        </p>
      </div>

      {/* Main Tuner Card */}
      <Card className="max-w-2xl mx-auto p-6 mb-6">
        {/* Top bar: badge + reference pitch */}
        <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
          <Badge variant="secondary">
            <AudioWaveform className="h-3 w-3" />
            Chromatic
          </Badge>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              value={selectedInstrument}
              onValueChange={setSelectedInstrument}
            >
              <SelectTrigger className="w-[120px] h-8">
                <Music className="h-3 w-3 mr-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TUNABLE_INSTRUMENTS.map((inst) => (
                  <SelectItem key={inst} value={inst}>
                    {inst}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">A4 =</label>
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
        </div>

        {/* Semi-circle arc gauge */}
        <div className="flex justify-center mb-4">
          <svg
            viewBox="0 0 340 185"
            className="w-full max-w-sm"
            aria-label="Tuning gauge"
          >
            {/* Arc segments */}
            {ARC_SEGMENTS.map((seg) => (
              <path
                key={`${seg.start}-${seg.end}`}
                d={arcPath(seg.start, seg.end)}
                fill="none"
                stroke={seg.color}
                strokeWidth={18}
                strokeLinecap="round"
                opacity={0.85}
              />
            ))}

            {/* Tick marks */}
            {TICKS.map((t) => {
              const tick = tickMark(t, R - 16, R + 16)
              const isCenter = t === 0
              return (
                <line
                  key={t}
                  x1={tick.x1}
                  y1={tick.y1}
                  x2={tick.x2}
                  y2={tick.y2}
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={isCenter ? 2.5 : 1.5}
                  opacity={isCenter ? 1 : 0.5}
                />
              )
            })}

            {/* Needle */}
            <line
              x1={CX}
              y1={CY}
              x2={needleTip.x}
              y2={needleTip.y}
              stroke="hsl(var(--foreground))"
              strokeWidth={2.5}
              strokeLinecap="round"
              style={{
                transition: 'x2 100ms ease-out, y2 100ms ease-out',
              }}
            />

            {/* Pivot circle */}
            <circle cx={CX} cy={CY} r={6} fill="hsl(var(--foreground))" />
            <circle cx={CX} cy={CY} r={3} fill="hsl(var(--background))" />

            {/* Labels */}
            <text
              x={18}
              y={CY + 6}
              textAnchor="start"
              fontSize={12}
              fill="hsl(var(--muted-foreground))"
              fontFamily="inherit"
            >
              Flat
            </text>
            <text
              x={322}
              y={CY + 6}
              textAnchor="end"
              fontSize={12}
              fill="hsl(var(--muted-foreground))"
              fontFamily="inherit"
            >
              Sharp
            </text>
          </svg>
        </div>

        {/* Note display */}
        <div className="flex flex-col items-center gap-1 mb-6">
          <div className={cn('text-5xl sm:text-7xl font-bold font-mono transition-colors', noteColor)}>
            {note && octave !== null ? `${note}${octave}` : '--'}
          </div>

          <div className="text-lg font-mono text-muted-foreground">
            {frequency !== null ? `${frequency.toFixed(1)} Hz` : '-- Hz'}
          </div>

          <div className={cn('flex items-center gap-1.5 text-sm font-medium mt-1', tuningStatus.color)}>
            <StatusIcon className="h-4 w-4" />
            {tuningStatus.label}
          </div>
        </div>

        {/* Instrument tuning info */}
        {INSTRUMENT_TUNING_INFO[selectedInstrument] && (
          <div className="rounded-lg bg-muted/50 p-4 mb-6 text-center">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{selectedInstrument}</span>
              {' — '}
              {INSTRUMENT_TUNING_INFO[selectedInstrument].description}
            </p>
            {INSTRUMENT_TUNING_INFO[selectedInstrument].strings && (
              <div className="flex items-center justify-center gap-1.5 mt-2 flex-wrap">
                {INSTRUMENT_TUNING_INFO[selectedInstrument].strings!.map((s) => (
                  <Badge key={s} variant="outline" className="text-xs font-mono">
                    {s}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Circular mic button */}
        <div className="flex justify-center">
          <div className="relative">
            {isListening && (
              <span className="absolute inset-0 rounded-full bg-destructive/30 animate-ping" />
            )}
            <Button
              variant={isListening ? 'destructive' : 'default'}
              className="rounded-full h-16 w-16 relative"
              onClick={isListening ? stopListening : startListening}
              aria-label={isListening ? 'Stop tuner' : 'Start tuner'}
            >
              {isListening ? (
                <MicOff className="h-6 w-6" />
              ) : (
                <Mic className="h-6 w-6" />
              )}
            </Button>
          </div>
        </div>
      </Card>

      {/* Permission Denied Card */}
      {hasPermission === false && (
        <Card className="max-w-2xl mx-auto p-6 border-destructive/50 bg-destructive/5">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive mt-0.5 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-destructive">
                Microphone Access Denied
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {error || 'Please allow microphone access in your browser settings to use the tuner.'}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={startListening}
              >
                Try Again
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Generic error (not permission related) */}
      {error && hasPermission !== false && (
        <Card className="max-w-2xl mx-auto p-6 border-destructive/50 bg-destructive/5">
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
                Try Again
              </Button>
            </div>
          </div>
        </Card>
      )}
    </>
  )
}
