'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Headphones, Speaker, AlertTriangle } from 'lucide-react'
import type { AudioMode } from '@/hooks/use-exercise-session'

interface AudioModePromptProps {
  onSelect: (mode: AudioMode) => void
}

export function AudioModePrompt({ onSelect }: AudioModePromptProps) {
  const [showWarning, setShowWarning] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center gap-6 p-8 max-w-md mx-auto"
    >
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold text-foreground">How are you listening?</h3>
        <p className="text-sm text-muted-foreground">
          This helps us optimize microphone detection for your setup.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full">
        <Button
          variant="outline"
          onClick={() => onSelect('headphones')}
          className="flex-1 h-auto py-4 px-4 flex flex-col items-center gap-2 border-border hover:border-primary hover:bg-primary/5 transition-colors"
        >
          <Headphones className="w-8 h-8 text-foreground" />
          <span className="text-sm font-semibold">Headphones</span>
          <span className="text-[11px] text-muted-foreground">Best accuracy</span>
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            if (!showWarning) {
              setShowWarning(true)
            } else {
              onSelect('speaker-safe')
            }
          }}
          className="flex-1 h-auto py-4 px-4 flex flex-col items-center gap-2 border-border hover:border-yellow-500/50 hover:bg-yellow-500/5 transition-colors"
        >
          <Speaker className="w-8 h-8 text-foreground" />
          <span className="text-sm font-semibold">Speakers</span>
          <span className="text-[11px] text-muted-foreground">Reduced accuracy</span>
        </Button>
      </div>

      {showWarning && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="w-full p-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10"
        >
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Speaker mode reduces backing track volume and raises detection thresholds to minimize mic bleed. Results may be less accurate.
              </p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onSelect('speaker-safe')}
                className="text-xs h-7 px-2 text-yellow-500 hover:text-yellow-400"
              >
                Continue with speakers
              </Button>
            </div>
          </div>
        </motion.div>
      )}
    </motion.div>
  )
}
