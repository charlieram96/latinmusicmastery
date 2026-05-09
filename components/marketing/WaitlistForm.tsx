"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/components/language-provider"
import { WaitlistDetailsModal } from "@/components/marketing/WaitlistDetailsModal"

type Option = { id: string; name: string }

interface WaitlistFormProps {
  title?: string
  subtitle?: string
  variant?: "default" | "hero" | "immersive"
  instruments?: Option[]
  styles?: Option[]
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function WaitlistForm({
  title,
  subtitle,
  variant = "default",
  instruments = [],
  styles = [],
}: WaitlistFormProps) {
  const [email, setEmail] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const { t } = useTranslation()

  const isHero = variant === "hero"
  const isImmersive = variant === "immersive"
  const isDark = isHero || isImmersive

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!EMAIL_RE.test(email)) {
      setEmailError(t("homepage.waitlistForm.invalidEmail"))
      return
    }
    setEmailError(null)
    setModalOpen(true)
  }

  return (
    <div
      className={cn(
        "w-full",
        isImmersive ? "max-w-2xl text-center mx-auto" : "max-w-md",
        title && !isImmersive && "text-center mx-auto"
      )}
    >
      {isImmersive && (
        <span className="mb-5 inline-block rounded-full border border-white/20 bg-white/10 px-5 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-white backdrop-blur-sm">
          {t("homepage.waitlistForm.launchingSoon")}
        </span>
      )}

      {title && (
        <h3
          className={cn(
            "font-semibold",
            isImmersive
              ? "mb-3 text-3xl font-bold tracking-tight text-white md:text-4xl lg:text-5xl font-heading"
              : isHero
                ? "mb-2 text-lg text-white"
                : "mb-2 text-sm text-foreground"
          )}
        >
          {title}
        </h3>
      )}
      {subtitle && (
        <p
          className={cn(
            isImmersive
              ? "mb-8 text-base text-white/70 md:text-lg"
              : isDark
                ? "mb-4 text-sm text-white/70"
                : "mb-4 text-sm text-muted-foreground"
          )}
        >
          {subtitle}
        </p>
      )}

      {submitted ? (
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
          {t("homepage.waitlistForm.success")}
        </motion.div>
      ) : (
        <form
          onSubmit={handleSubmit}
          className={cn("flex gap-3", isImmersive && "mx-auto max-w-lg")}
        >
          <input
            type="email"
            name="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("homepage.waitlistForm.emailPlaceholder")}
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
            className={cn(
              "rounded-full whitespace-nowrap font-semibold transition-all",
              isImmersive
                ? "bg-primary px-8 py-3 text-base text-white hover:bg-primary/90 shadow-lg shadow-primary/25"
                : isDark
                  ? "bg-gradient-to-r from-primary to-orange-500 px-6 py-2.5 text-sm text-white hover:shadow-lg hover:shadow-primary/20 hover:brightness-110"
                  : "px-5"
            )}
          >
            {isImmersive
              ? t("homepage.waitlistForm.getEarlyAccess")
              : t("homepage.waitlistForm.joinWaitlist")}
          </Button>
        </form>
      )}

      {emailError && !submitted && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mt-2 text-xs",
            isDark ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {emailError}
        </motion.p>
      )}

      <WaitlistDetailsModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        email={email}
        instruments={instruments}
        styles={styles}
        onSuccess={() => setSubmitted(true)}
      />
    </div>
  )
}
