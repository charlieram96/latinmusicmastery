'use client'

import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Undo2, Redo2, Play, Square, ZoomIn, ZoomOut } from 'lucide-react'

interface SequencerToolbarProps {
  subdivision: number
  onSubdivisionChange: (sub: number) => void
  zoom: number
  onZoomChange: (zoom: number) => void
  canUndo: boolean
  canRedo: boolean
  onUndo: () => void
  onRedo: () => void
  isPlaying: boolean
  onPlayStop: () => void
}

export function SequencerToolbar({
  subdivision,
  onSubdivisionChange,
  zoom,
  onZoomChange,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  isPlaying,
  onPlayStop,
}: SequencerToolbarProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Subdivision */}
      <div className="flex items-center gap-1.5">
        <span className="text-xs text-muted-foreground">Grid</span>
        <Select
          value={String(subdivision)}
          onValueChange={(v) => onSubdivisionChange(Number(v))}
        >
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1">1/4</SelectItem>
            <SelectItem value="2">1/8</SelectItem>
            <SelectItem value="4">1/16</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Zoom */}
      <div className="flex items-center gap-0.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onZoomChange(Math.max(0.75, zoom - 0.25))}
          disabled={zoom <= 0.75}
        >
          <ZoomOut className="w-3.5 h-3.5" />
        </Button>
        <span className="text-xs text-muted-foreground w-8 text-center">{zoom}x</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 p-0"
          onClick={() => onZoomChange(Math.min(1.5, zoom + 0.25))}
          disabled={zoom >= 1.5}
        >
          <ZoomIn className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* Divider */}
      <div className="w-px h-5 bg-border" />

      {/* Undo/Redo */}
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onUndo} disabled={!canUndo}>
        <Undo2 className="w-3.5 h-3.5" />
      </Button>
      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={onRedo} disabled={!canRedo}>
        <Redo2 className="w-3.5 h-3.5" />
      </Button>

      {/* Divider */}
      <div className="w-px h-5 bg-border" />

      {/* Play/Stop */}
      <Button
        variant={isPlaying ? 'destructive' : 'default'}
        size="sm"
        className="h-7 px-3 text-xs"
        onClick={onPlayStop}
      >
        {isPlaying ? (
          <><Square className="w-3 h-3 mr-1" /> Stop</>
        ) : (
          <><Play className="w-3 h-3 mr-1" /> Preview</>
        )}
      </Button>
    </div>
  )
}
