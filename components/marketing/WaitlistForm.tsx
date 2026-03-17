"use client"

import { useState, useTransition } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { joinWaitlist } from "@/app/actions/waitlist"

interface WaitlistFormProps {
  title?: string
  subtitle?: string
  variant?: "default" | "hero"
}

export function WaitlistForm({ title, subtitle, variant = "default" }: WaitlistFormProps) {
  const [isPending, startTransition] = useTransition()
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null)

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      const res = await joinWaitlist(formData)
      setResult(res)
    })
  }

  const isHero = variant === "hero"

  return (
    <div className={cn("w-full max-w-md", title && "text-center mx-auto")}>
      {title && (
        <h3 className={cn(
          "mb-2 font-semibold",
          isHero ? "text-lg text-white" : "text-sm text-foreground"
        )}>
          {title}
        </h3>
      )}
      {subtitle && (
        <p className={cn(
          "mb-4 text-sm",
          isHero ? "text-white/70" : "text-muted-foreground"
        )}>
          {subtitle}
        </p>
      )}

      {result?.success ? (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-full border px-4 py-2.5 text-center text-sm font-medium",
            isHero
              ? "border-white/20 bg-white/10 text-white"
              : "border-primary/20 bg-primary/5 text-primary"
          )}
        >
          You&apos;re on the list! We&apos;ll be in touch soon.
        </motion.div>
      ) : (
        <form action={handleSubmit} className="flex gap-2">
          <input
            type="email"
            name="email"
            placeholder="you@email.com"
            required
            className={cn(
              "flex-1 rounded-full border px-4 py-2 text-sm transition-colors",
              "focus:outline-none focus:ring-2",
              isHero
                ? "border-white/20 bg-white/10 text-white placeholder:text-white/50 focus:ring-white/30 focus:border-white/40"
                : "border-border bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/50 focus:border-primary"
            )}
          />
          <Button
            type="submit"
            size="sm"
            disabled={isPending}
            className={cn(
              "rounded-full px-5 whitespace-nowrap",
              isHero && "bg-white text-gray-900 hover:bg-white/90"
            )}
          >
            {isPending ? "Joining..." : "Join Waitlist"}
          </Button>
        </form>
      )}

      {result?.error && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mt-2 text-xs",
            isHero ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {result.error}
        </motion.p>
      )}
    </div>
  )
}
