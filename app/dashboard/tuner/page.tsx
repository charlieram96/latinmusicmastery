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

export default function TunerPage() {
  const [referencePitch, setReferencePitch] = useState(440)
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

  // Gauge needle position: cents ranges from -50 to +50, map to 0% - 100%
  const needlePosition = cents !== null ? ((cents + 50) / 100) * 100 : 50

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
        {/* Top bar */}
        <div className="flex items-center justify-between mb-6">
          <Badge variant="secondary">
            <AudioWaveform className="h-3 w-3" />
            Chromatic
          </Badge>
          <span className="text-sm text-muted-foreground font-mono">
            A4 = {referencePitch} Hz
          </span>
        </div>

        {/* Gauge meter */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-full max-w-lg">
            {/* Tick labels */}
            <div className="flex justify-between px-1 mb-1">
              <span className="text-[10px] text-muted-foreground font-mono">-50</span>
              <span className="text-[10px] text-muted-foreground font-mono">-25</span>
              <span className="text-[10px] text-muted-foreground font-mono font-bold">0</span>
              <span className="text-[10px] text-muted-foreground font-mono">+25</span>
              <span className="text-[10px] text-muted-foreground font-mono">+50</span>
            </div>

            {/* Gradient bar with needle */}
            <div className="relative h-8 rounded-full overflow-hidden bg-muted">
              {/* Gradient */}
              <div
                className="absolute inset-0 rounded-full"
                style={{
                  background:
                    'linear-gradient(to right, #ef4444, #eab308 25%, #22c55e 45%, #22c55e 55%, #eab308 75%, #ef4444)',
                }}
              />

              {/* Needle */}
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow-lg transition-all duration-100 ease-out"
                style={{
                  left: `calc(${needlePosition}% - 2px)`,
                  boxShadow: '0 0 6px rgba(0,0,0,0.5)',
                }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md" />
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-md" />
              </div>

              {/* Center tick */}
              <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-0.5 bg-white/40" />
            </div>

            {/* Flat / Sharp labels */}
            <div className="flex justify-between px-1 mt-1">
              <span className="text-xs text-muted-foreground">Flat</span>
              <span className="text-xs text-muted-foreground">Sharp</span>
            </div>
          </div>
        </div>

        {/* Note display */}
        <div className="flex flex-col items-center gap-1 mb-6">
          <div className={cn('text-5xl sm:text-7xl font-bold font-mono transition-colors', noteColor)}>
            {note && octave !== null ? `${note}${octave}` : '--'}
          </div>

          {/* Frequency readout */}
          <div className="text-lg font-mono text-muted-foreground">
            {frequency !== null ? `${frequency.toFixed(1)} Hz` : '-- Hz'}
          </div>

          {/* Status text */}
          <div className={cn('flex items-center gap-1.5 text-sm font-medium mt-1', tuningStatus.color)}>
            <StatusIcon className="h-4 w-4" />
            {tuningStatus.label}
          </div>
        </div>

        {/* Start/Stop button */}
        <Button
          size="lg"
          className="w-full h-12 text-base"
          variant={isListening ? 'destructive' : 'default'}
          onClick={isListening ? stopListening : startListening}
        >
          {isListening ? (
            <>
              <MicOff className="h-5 w-5 mr-2" />
              Stop Tuner
            </>
          ) : (
            <>
              <Mic className="h-5 w-5 mr-2" />
              Start Tuner
            </>
          )}
        </Button>
      </Card>

      {/* Settings Card */}
      <Card className="max-w-2xl mx-auto p-6 mb-6">
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium">Reference Pitch (A4)</label>
          <Select
            value={referencePitch.toString()}
            onValueChange={(val) => setReferencePitch(Number(val))}
          >
            <SelectTrigger className="w-[120px]">
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
