"use client"

import Link from "next/link"
import Image from "next/image"
import { ShieldCheck } from "lucide-react"
import { WaitlistForm } from "@/components/marketing/WaitlistForm"
import { socialLinks, SocialIconRow } from "@/components/marketing/SocialLinks"
import { useTranslation } from "@/components/language-provider"

const platformLinks = [
  { labelKey: "footer.links.exploreCourses", href: "/explore" },
  { labelKey: "footer.links.pricing", href: "/pricing" },
  { labelKey: "footer.links.instructors", href: "/instructors" },
  { labelKey: "footer.links.playsense", href: "/playsense" },
]

const companyLinks = [
  { labelKey: "footer.links.about", href: "/about" },
  { labelKey: "footer.links.blog", href: "/blog" },
  { labelKey: "footer.links.faq", href: "/faq" },
  { labelKey: "footer.links.contact", href: "/contact" },
]

const legalLinks = [
  { labelKey: "footer.links.privacy", href: "/privacy" },
  { labelKey: "footer.links.terms", href: "/terms" },
  { labelKey: "footer.links.accessibility", href: "/accessibility" },
]

function FooterColumn({
  title,
  links,
  t,
}: {
  title: string
  links: { labelKey: string; href: string }[]
  t: (key: string) => string
}) {
  return (
    <div>
      <h3 className="mb-4 text-sm font-semibold text-foreground">{title}</h3>
      <ul className="space-y-3">
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {t(link.labelKey)}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function MarketingFooter() {
  const { t } = useTranslation()
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          <div className="sm:col-span-2 lg:col-span-1">
            <Link href="/" className="inline-block">
              <Image
                src="/large-color-logo.svg"
                alt="Latin Music Mastery"
                width={160}
                height={36}
                className="h-9 w-auto"
              />
            </Link>
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">
              {t("footer.tagline")}
            </p>
            <SocialIconRow className="mt-6" />
          </div>

          <FooterColumn title={t("footer.platform")} links={platformLinks} t={t} />
          <FooterColumn title={t("footer.company")} links={companyLinks} t={t} />
          <FooterColumn title={t("footer.legal")} links={legalLinks} t={t} />

          <div className="sm:col-span-2 lg:col-span-1">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              {t("footer.joinWaitlist")}
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              {t("footer.waitlistCopy")}
            </p>
            <WaitlistForm />
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-4 border-t border-border py-6 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            {t("footer.copyright", { year: currentYear })}
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
              aria-label={t("footer.adminLogin")}
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
            <p className="text-sm text-muted-foreground">
              {t("footer.madeWithLovePre")}{" "}
              <span className="text-primary" aria-label={t("footer.love")}>
                &#9829;
              </span>{" "}
              {t("footer.madeWithLovePost")}
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
