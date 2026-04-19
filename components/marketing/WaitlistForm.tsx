"use client"

import { useState, useTransition } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { joinWaitlist } from "@/app/actions/waitlist"
import { useTranslation } from "@/components/language-provider"

interface WaitlistFormProps {
  title?: string
  subtitle?: string
  variant?: "default" | "hero" | "immersive"
}

export function WaitlistForm({ title, subtitle, variant = "default" }: WaitlistFormProps) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)
  const { t } = useTranslation()

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await joinWaitlist(formData)
      setResult(res)
    })
  }

  const isHero = variant === "hero"
  const isImmersive = variant === "immersive"
  const isDark = isHero || isImmersive

  return (
    <div className={cn(
      "w-full",
      isImmersive ? "max-w-2xl text-center mx-auto" : "max-w-md",
      title && !isImmersive && "text-center mx-auto"
    )}>
      {isImmersive && (
        <span className="mb-5 inline-block rounded-full border border-white/20 bg-white/10 px-5 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
          {t('homepage.waitlistForm.launchingSoon')}
        </span>
      )}

      {title && (
        <h3 className={cn(
          "font-semibold",
          isImmersive
            ? "mb-3 text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl font-heading"
            : isHero
              ? "mb-2 text-lg text-white"
              : "mb-2 text-sm text-foreground"
        )}>
          {title}
        </h3>
      )}
      {subtitle && (
        <p className={cn(
          isImmersive
            ? "mb-8 text-base text-white/70 md:text-lg"
            : isDark
              ? "mb-4 text-sm text-white/70"
              : "mb-4 text-sm text-muted-foreground"
        )}>
          {subtitle}
        </p>
      )}

      {result?.success ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-full border px-6 py-3 text-center font-medium",
            isDark
              ? "border-white/20 bg-white/10 text-white text-sm"
              : "border-primary/20 bg-primary/5 text-primary text-sm"
          )}
        >
          {t('homepage.waitlistForm.success')}
        </motion.div>
      ) : (
        <form action={handleSubmit} className={cn(
          "flex gap-3",
          isImmersive && "mx-auto max-w-lg"
        )}>
          <input
            type="email"
            name="email"
            placeholder={t('homepage.waitlistForm.emailPlaceholder')}
            required
            className={cn(
              "flex-1 rounded-full border transition-colors",
              "focus:outline-none focus:ring-2",
              isImmersive
                ? "border-white/25 bg-white/10 px-5 py-3 text-base text-white placeholder:text-white/50 focus:ring-white/30 focus:border-white/40 backdrop-blur-sm"
                : isDark
                  ? "border-white/20 bg-white/10 px-5 py-2.5 text-sm text-white placeholder:text-white/50 focus:ring-white/30 focus:border-white/40 backdrop-blur-sm"
                  : "border-border bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:ring-primary/50 focus:border-primary"
            )}
          />
          <Button
            type="submit"
            size={isImmersive ? "lg" : isHero ? "default" : "sm"}
            disabled={isPending}
            className={cn(
              "rounded-full whitespace-nowrap font-semibold transition-all",
              isImmersive
                ? "bg-primary px-8 py-3 text-base text-white hover:bg-primary/90 shadow-lg shadow-primary/25"
                : isDark
                  ? "bg-gradient-to-r from-primary to-orange-500 px-6 py-2.5 text-sm text-white hover:shadow-lg hover:shadow-primary/20 hover:brightness-110"
                  : "px-5"
            )}
          >
            {isPending ? t('homepage.waitlistForm.joining') : isImmersive ? t('homepage.waitlistForm.getEarlyAccess') : t('homepage.waitlistForm.joinWaitlist')}
          </Button>
        </form>
      )}

      {result?.error && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mt-2 text-xs",
            isDark ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {result.error}
        </motion.p>
      )}
    </div>
  )
}
