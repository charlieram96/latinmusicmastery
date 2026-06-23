'use client'

import { Check, CloudUpload, Save, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useSaveStatus } from './save-status'
import { useItemSave } from './item-save-context'

/** Sticky footer for the item drawer: an explicit Save button plus a clear,
    local "where are my changes" status. Autosave still runs in the background;
    the button is an immediate-flush shortcut and reassurance. */
export function ItemSaveBar() {
  const { state, errorMessage } = useSaveStatus()
  const { dirty, flushAll } = useItemSave()

  const status =
    state === 'error'
      ? {
          icon: TriangleAlert,
          text: errorMessage ? `Couldn’t save — ${errorMessage}` : 'Couldn’t save',
          cls: 'text-destructive',
          pulse: false,
        }
      : state === 'saving'
        ? { icon: CloudUpload, text: 'Saving…', cls: 'text-muted-foreground', pulse: true }
        : dirty
          ? { icon: CloudUpload, text: 'Unsaved changes', cls: 'text-muted-foreground', pulse: false }
          : { icon: Check, text: 'All changes saved', cls: 'text-muted-foreground/70', pulse: false }

  const Icon = status.icon

  return (
    <div className="sticky bottom-0 z-10 flex items-center justify-between gap-3 border-t border-border bg-card/95 px-5 py-3 backdrop-blur-sm">
      <span className={cn('flex items-center gap-1.5 text-xs tabular-nums', status.cls)}>
        <Icon className={cn('h-3.5 w-3.5', status.pulse && 'animate-pulse')} />
        {status.text}
      </span>
      <Button
        type="button"
        size="sm"
        onClick={flushAll}
        disabled={!dirty && state !== 'error'}
        className="h-8"
      >
        <Save className="mr-1.5 h-3.5 w-3.5" />
        Save
      </Button>
    </div>
  )
}
