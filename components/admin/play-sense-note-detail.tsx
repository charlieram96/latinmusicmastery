'use client'

import { AdminText } from '@/components/admin/admin-text'


import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card } from '@/components/ui/card'
import type { ExerciseEvent, Hand } from '@/lib/play-sense/types'
import { Trash2, X } from 'lucide-react'

interface NoteDetailProps {
  event: ExerciseEvent
  onUpdate: (updates: Partial<ExerciseEvent>) => void
  onDelete: () => void
  onClose: () => void
}

export function PlaySenseNoteDetail({ event, onUpdate, onDelete, onClose }: NoteDetailProps) {
  return (
    <Card className="p-4 space-y-3 bg-slate-900 border-slate-700">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium"> <AdminText text={"Note:"} /> {event.technique} (M{event.measure} B{event.beat})
        </h4>
        <Button variant="ghost" size="sm" onClick={onClose} className="h-6 w-6 p-0">
          <X className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="space-y-1">
          <Label className="text-xs"><AdminText text={"Hand"} /></Label>
          <Select
            value={event.hand}
            onValueChange={(v) => onUpdate({ hand: v as Hand })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="R"><AdminText text={"Right (R)"} /></SelectItem>
              <SelectItem value="L"><AdminText text={"Left (L)"} /></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs"><AdminText text={"Duration (beats)"} /></Label>
          <Select
            value={String(event.duration)}
            onValueChange={(v) => onUpdate({ duration: Number(v) })}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.25">1/16</SelectItem>
              <SelectItem value="0.5">1/8</SelectItem>
              <SelectItem value="1">1/4</SelectItem>
              <SelectItem value="2">1/2</SelectItem>
              <SelectItem value="4"><AdminText text={"Whole"} /></SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">VexFlow Key</Label>
          <Input
            className="h-8 text-xs font-mono"
            value={event.vexKey}
            onChange={(e) => onUpdate({ vexKey: e.target.value })}
            placeholder="c/5"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs"><AdminText text={"Accent"} /></Label>
          <div className="flex items-center gap-2 h-8">
            <Switch
              checked={event.accent}
              onCheckedChange={(checked) => onUpdate({ accent: checked })}
            />
            <span className="text-xs text-muted-foreground">{event.accent ? 'On' : 'Off'}</span>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button variant="destructive" size="sm" onClick={onDelete}>
          <Trash2 className="w-3 h-3 mr-1" /> <AdminText text={"Delete Note"} /> </Button>
      </div>
    </Card>
  )
}
