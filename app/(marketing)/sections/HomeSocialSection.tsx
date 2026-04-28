"use client"

import { motion } from "framer-motion"
import { socialLinks } from "@/components/marketing/SocialLinks"
import { useTranslation } from "@/components/language-provider"

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
}

export function HomeSocialSection() {
  const { t } = useTranslation()
  return (
    <section className="py-20 sm:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
        >
          {t('homepage.homeSections.socialSection.heading')}
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground"
        >
          {t('homepage.homeSections.socialSection.description')}
        </motion.p>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="mt-10 flex flex-wrap items-center justify-center gap-6"
        >
          {socialLinks.map((social) => (
            <motion.a
              key={social.label}
              variants={item}
              href={social.href}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ scale: 1.05, y: -4 }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400, damping: 17 }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card px-6 py-4 shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                <social.icon className="h-5 w-5" />
              </span>
              <span className="text-sm font-semibold text-foreground">
                {social.label}
              </span>
            </motion.a>
          ))}
        </motion.div>
      </div>
    </section>
  )
}
