'use client'

import { useState } from 'react'
import { SmilePlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface ReactionCount {
  emoji: string
  count: number
  hasReacted: boolean
}

interface ReactionBarProps {
  reactions: ReactionCount[]
  onReact: (emoji: string) => void
}

const EMOJI_OPTIONS = ['👍', '❤️', '🔥', '💯', '👏', '🎵', '⭐', '🤯']

export function ReactionBar({ reactions, onReact }: ReactionBarProps) {
  const [open, setOpen] = useState(false)

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {reactions.map((reaction) => (
        <button
          key={reaction.emoji}
          onClick={() => onReact(reaction.emoji)}
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors',
            reaction.hasReacted
              ? 'bg-primary/10 border-primary/30 text-primary'
              : 'bg-muted border-border hover:bg-muted/80'
          )}
        >
          <span>{reaction.emoji}</span>
          <span className="font-medium">{reaction.count}</span>
        </button>
      ))}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 rounded-full">
            <SmilePlus className="h-3.5 w-3.5 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-2" align="start">
          <div className="grid grid-cols-4 gap-1">
            {EMOJI_OPTIONS.map((emoji) => (
              <button
                key={emoji}
                onClick={() => {
                  onReact(emoji)
                  setOpen(false)
                }}
                className="text-lg hover:bg-muted rounded p-1.5 transition-colors"
              >
                {emoji}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
