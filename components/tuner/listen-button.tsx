'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { Lightbulb, Mic } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import type { EngineStatus } from '@/hooks/use-tuner-engine'

interface ListenButtonProps {
  status: EngineStatus
  onToggle: () => void
}

export function ListenButton({ status, onToggle }: ListenButtonProps) {
  const { t } = useTranslation()
  const reduce = useReducedMotion()
  const live = status === 'listening'
  const starting = status === 'starting'

  return (
    <div className="flex flex-col items-center">
      <button
        type="button"
        onClick={onToggle}
        disabled={starting}
        aria-pressed={live}
        className={cn(
          'mt-4 inline-flex h-12 w-full items-center justify-center gap-2.5 rounded-xl px-8 font-heading text-[13px] font-bold uppercase tracking-[0.12em] transition-all focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-70 sm:w-auto sm:min-w-[260px]',
          live
            ? 'border border-border bg-raised text-foreground hover:bg-muted/60'
            : 'bg-gradient-to-b from-gold to-[hsl(38_58%_46%)] text-[#1C1405] shadow-[0_10px_30px_-12px_hsl(var(--gold-highlight)/0.7)] hover:brightness-105 active:translate-y-px'
        )}
      >
        {live ? (
          <span className="relative flex h-2.5 w-2.5">
            {!reduce && (
              <motion.span
                className="absolute inset-0 rounded-full bg-terracotta"
                animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
                transition={{ duration: 1.6, repeat: Infinity, ease: 'easeOut' }}
              />
            )}
            <span className="relative h-2.5 w-2.5 rounded-full bg-terracotta" />
          </span>
        ) : (
          <Mic className="h-[18px] w-[18px]" />
        )}
        <span>
          {live
            ? t('dashboard.pages.tuner.listen.stop')
            : starting
              ? t('dashboard.pages.tuner.listen.starting')
              : t('dashboard.pages.tuner.listen.start')}
        </span>
      </button>
      <div className="mt-2.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lightbulb className="h-[13px] w-[13px] text-gold" />
        <span>{t(live ? 'dashboard.pages.tuner.listen.hintLive' : 'dashboard.pages.tuner.listen.hintIdle')}</span>
      </div>
    </div>
  )
}
