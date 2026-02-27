'use client'

import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Headphones, Volume2 } from 'lucide-react'

interface SensitivitySettingsProps {
  noisyRoomMode: boolean
  onNoisyRoomChange: (enabled: boolean) => void
  inputLevel: number
}

export function SensitivitySettings({
  noisyRoomMode,
  onNoisyRoomChange,
  inputLevel,
}: SensitivitySettingsProps) {
  const meterWidth = Math.min(inputLevel * 500, 100)

  return (
    <div className="space-y-4">
      {/* Headphones recommendation */}
      <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
        <Headphones className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
        <p className="text-xs text-muted-foreground">
          Use headphones for best results. This prevents the metronome from triggering false onset detections.
        </p>
      </div>

      {/* Noisy room toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <Label htmlFor="noisy-room" className="text-sm">
            Noisy Room Mode
          </Label>
          {noisyRoomMode && <Badge variant="secondary" className="text-xs">Active</Badge>}
        </div>
        <Switch
          id="noisy-room"
          checked={noisyRoomMode}
          onCheckedChange={onNoisyRoomChange}
        />
      </div>
      <p className="text-xs text-muted-foreground -mt-2 ml-6">
        Raises detection threshold and narrows frequency band. Reduces sensitivity but rejects more ambient noise.
      </p>

      {/* Mic level */}
      <div>
        <p className="text-xs text-muted-foreground mb-1">Mic Level</p>
        <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-75"
            style={{
              width: `${meterWidth}%`,
              backgroundColor: meterWidth > 80 ? '#ef4444' : meterWidth > 50 ? '#eab308' : '#22c55e',
            }}
          />
        </div>
      </div>
    </div>
  )
}
