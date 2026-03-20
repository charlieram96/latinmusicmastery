"use client"

import Link from "next/link"
import Image from "next/image"
import { ShieldCheck } from "lucide-react"
import { WaitlistForm } from "@/components/marketing/WaitlistForm"
import { socialLinks, SocialIconRow } from "@/components/marketing/SocialLinks"

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const platformLinks = [
  { label: "Explore Courses", href: "/explore" },
  { label: "Pricing", href: "/pricing" },
  { label: "Instructors", href: "/instructors" },
  { label: "PlaySense", href: "/playsense" },
]

const companyLinks = [
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "FAQ", href: "/faq" },
  { label: "Contact", href: "/contact" },
]

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy" },
  { label: "Terms of Service", href: "/terms" },
  { label: "Accessibility", href: "/accessibility" },
]

/* ------------------------------------------------------------------ */
/*  Footer Link Column                                                 */
/* ------------------------------------------------------------------ */

function FooterColumn({
  title,
  links,
}: {
  title: string
  links: { label: string; href: string }[]
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
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Footer                                                        */
/* ------------------------------------------------------------------ */

export function MarketingFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Top section */}
        <div className="grid grid-cols-1 gap-10 py-12 sm:grid-cols-2 lg:grid-cols-5 lg:gap-8">
          {/* Brand column - spans 2 on lg */}
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
              Master the rhythms, melodies, and soul of Latin music with
              world-class instructors from across the Americas.
            </p>

            {/* Social icons */}
            <SocialIconRow className="mt-6" />
          </div>

          {/* Link columns */}
          <FooterColumn title="Platform" links={platformLinks} />
          <FooterColumn title="Company" links={companyLinks} />
          <FooterColumn title="Legal" links={legalLinks} />

          {/* Waitlist */}
          <div className="sm:col-span-2 lg:col-span-1">
            <h3 className="mb-4 text-sm font-semibold text-foreground">
              Join the waiting list
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Be the first to know when we launch.
            </p>
            <WaitlistForm />
          </div>
        </div>

        {/* Bottom bar */}
        <div className="flex flex-col items-center justify-between gap-4 border-t border-border py-6 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            &copy; {currentYear} Latin Music Mastery. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <Link
              href="/login"
              className="text-muted-foreground/30 hover:text-muted-foreground transition-colors"
              aria-label="Admin login"
            >
              <ShieldCheck className="h-4 w-4" />
            </Link>
            <p className="text-sm text-muted-foreground">
              Made with{" "}
              <span className="text-primary" aria-label="love">
                &#9829;
              </span>{" "}
              for Latin music
            </p>
          </div>
        </div>
      </div>
    </footer>
  )
}
