'use client'

import { AdminText } from '@/components/admin/admin-text'


import { AudioUpload } from './audio-upload'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Music, Gauge } from 'lucide-react'

interface JamSessionEditorProps {
  itemId: string
  audioUrl: string | null
  bpm: number | null
  keySignature: string | null
  onChange: (data: {
    audio_url?: string
    bpm?: number | null
    key_signature?: string | null
  }) => void
}

const KEY_SIGNATURES = [
  'C',
  'C#/Db',
  'D',
  'D#/Eb',
  'E',
  'F',
  'F#/Gb',
  'G',
  'G#/Ab',
  'A',
  'A#/Bb',
  'B',
  'Cm',
  'C#m/Dbm',
  'Dm',
  'D#m/Ebm',
  'Em',
  'Fm',
  'F#m/Gbm',
  'Gm',
  'G#m/Abm',
  'Am',
  'A#m/Bbm',
  'Bm',
]

export function JamSessionEditor({
  itemId,
  audioUrl,
  bpm,
  keySignature,
  onChange,
}: JamSessionEditorProps) {
  return (
    <div className="space-y-6">
      <div className="grid gap-2">
        <Label className="flex items-center gap-2">
          <Music className="w-4 h-4" /> <AdminText text={"Backing Track Audio"} /> </Label>
        <AudioUpload
          itemId={itemId}
          currentAudioUrl={audioUrl}
          onAudioUploaded={(url) => onChange({ audio_url: url })}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="grid gap-2">
          <Label htmlFor="bpm" className="flex items-center gap-2">
            <Gauge className="w-4 h-4" />
            BPM
          </Label>
          <Input
            id="bpm"
            type="number"
            min={20}
            max={300}
            placeholder="120"
            value={bpm ?? ''}
            onChange={(e) => {
              const value = e.target.value
              onChange({
                bpm: value === '' ? null : parseInt(value, 10),
              })
            }}
          />
        </div>

        <div className="grid gap-2">
          <Label className="flex items-center gap-2">
            <Music className="w-4 h-4" /> <AdminText text={"Key Signature"} /> </Label>
          <Select
            value={keySignature ?? ''}
            onValueChange={(value) =>
              onChange({ key_signature: value || null })
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select key" />
            </SelectTrigger>
            <SelectContent>
              {KEY_SIGNATURES.map((key) => (
                <SelectItem key={key} value={key}>
                  {key}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
