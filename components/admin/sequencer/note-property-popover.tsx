'use client'

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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import type { ExerciseEvent, Hand } from '@/lib/play-sense/types'
import { Trash2 } from 'lucide-react'

interface NotePropertyPopoverProps {
  event: ExerciseEvent
  onUpdate: (updates: Partial<ExerciseEvent>) => void
  onDelete: () => void
  onClose: () => void
  children: React.ReactNode
  open: boolean
}

export function NotePropertyPopover({
  event,
  onUpdate,
  onDelete,
  onClose,
  children,
  open,
}: NotePropertyPopoverProps) {
  return (
    <Popover open={open} onOpenChange={(o) => !o && onClose()}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-64 p-3 space-y-3"
        side="right"
        align="start"
        sideOffset={8}
        onInteractOutside={() => onClose()}
      >
        <p className="text-xs font-medium text-muted-foreground">
          {event.technique} &mdash; M{event.measure} B{event.beat}
        </p>

        {/* Hand toggle */}
        <div className="flex items-center gap-2">
          <Label className="text-xs w-14">Hand</Label>
          <div className="flex gap-1">
            <Button
              variant={event.hand === 'R' ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => onUpdate({ hand: 'R' as Hand })}
            >
              R
            </Button>
            <Button
              variant={event.hand === 'L' ? 'default' : 'outline'}
              size="sm"
              className="h-7 px-3 text-xs"
              onClick={() => onUpdate({ hand: 'L' as Hand })}
            >
              L
            </Button>
          </div>
        </div>

        {/* Accent */}
        <div className="flex items-center gap-2">
          <Label className="text-xs w-14">Accent</Label>
          <Switch
            checked={event.accent}
            onCheckedChange={(checked) => onUpdate({ accent: checked })}
          />
        </div>

        {/* Duration */}
        <div className="flex items-center gap-2">
          <Label className="text-xs w-14">Duration</Label>
          <Select
            value={String(event.duration)}
            onValueChange={(v) => onUpdate({ duration: Number(v) })}
          >
            <SelectTrigger className="h-7 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="0.25">1/16</SelectItem>
              <SelectItem value="0.5">1/8</SelectItem>
              <SelectItem value="1">1/4</SelectItem>
              <SelectItem value="2">1/2</SelectItem>
              <SelectItem value="4">Whole</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* VexFlow key */}
        <div className="flex items-center gap-2">
          <Label className="text-xs w-14">VexKey</Label>
          <Input
            className="h-7 text-xs font-mono flex-1"
            value={event.vexKey}
            onChange={(e) => onUpdate({ vexKey: e.target.value })}
            placeholder="c/5"
          />
        </div>

        <Button variant="destructive" size="sm" className="w-full h-7 text-xs" onClick={onDelete}>
          <Trash2 className="w-3 h-3 mr-1" />
          Delete
        </Button>
      </PopoverContent>
    </Popover>
  )
}
