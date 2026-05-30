"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import { Menu, X, ChevronDown, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { ThemeToggle } from "@/components/theme-toggle"
import { LanguageToggle } from "@/components/language-toggle"
import { useTranslation } from "@/components/language-provider"
import { socialLinks } from "@/components/marketing/SocialLinks"

/* ------------------------------------------------------------------ */
/*  Data                                                               */
/* ------------------------------------------------------------------ */

const countries = [
  { label: "Colombia", href: "/explore/colombia" },
  { label: "Cuba", href: "/explore/cuba" },
  { label: "Brazil", href: "/explore/brazil" },
  { label: "Mexico", href: "/explore/mexico" },
  { label: "Dominican Republic", href: "/explore/dominican-republic" },
  { label: "Puerto Rico", href: "/explore/puerto-rico" },
  { label: "Argentina", href: "/explore/argentina" },
  { label: "Peru", href: "/explore/peru" },
]

/** A {slug,name} catalog item from the DB (instruments / musical styles). */
type NavItem = { slug: string; name: string }
/** A resolved nav link rendered in the dropdowns. */
type NavLink = { label: string; href: string }

const aboutLinks = [
  { labelKey: "nav.aboutUs", href: "/about" },
  { labelKey: "nav.blog", href: "/blog" },
  { labelKey: "nav.faq", href: "/faq" },
  { labelKey: "nav.contact", href: "/contact" },
]

/* ------------------------------------------------------------------ */
/*  Desktop Mega-Menu                                                  */
/* ------------------------------------------------------------------ */

function ExploreMegaMenu({
  styleLinks,
  instrumentLinks,
}: {
  styleLinks: NavLink[]
  instrumentLinks: NavLink[]
}) {
  const { t } = useTranslation()
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="absolute left-1/2 top-full pt-3 -translate-x-1/2"
    >
      <div className="w-[720px] -ml-[30px] rounded-2xl border border-border bg-popover/95 backdrop-blur-xl shadow-stripe p-6">
        <div className="grid grid-cols-3 gap-8">
          {/* By Country */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("nav.byCountry")}
            </h4>
            <ul className="space-y-1.5">
              {countries.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-lg px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent/10 hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* By Style */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("nav.byStyle")}
            </h4>
            <ul className="space-y-1.5">
              {styleLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-lg px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent/10 hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* By Instrument */}
          <div>
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t("nav.byInstrument")}
            </h4>
            <ul className="space-y-1.5">
              {instrumentLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="block rounded-lg px-3 py-1.5 text-sm text-foreground/80 transition-colors hover:bg-accent/10 hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* CTA strip */}
        <div className="mt-6 flex items-center justify-between rounded-xl bg-primary/5 px-5 py-3">
          <p className="text-sm text-muted-foreground">
            {t("nav.discoverCopy")}
          </p>
          <Link
            href="/explore"
            className="text-sm font-semibold text-primary hover:underline"
          >
            {t("nav.browseAllCourses")} &rarr;
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Desktop About Dropdown                                             */
/* ------------------------------------------------------------------ */

function AboutDropdown() {
  const { t } = useTranslation()
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
      className="absolute left-1/2 top-full pt-3 -translate-x-1/2"
    >
      <div className="w-48 -ml-[30px] rounded-xl border border-border bg-popover/95 backdrop-blur-xl shadow-stripe-md py-2">
        {aboutLinks.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="block px-4 py-2 text-sm text-foreground/80 transition-colors hover:bg-accent/10 hover:text-foreground"
          >
            {t(item.labelKey)}
          </Link>
        ))}
      </div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mobile Accordion Section                                           */
/* ------------------------------------------------------------------ */

function MobileAccordion({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-4 text-base font-medium text-foreground"
      >
        {title}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            open && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="pb-4 pl-4 pr-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Mobile Drawer                                                      */
/* ------------------------------------------------------------------ */

function MobileDrawer({
  onClose,
  styleLinks,
  instrumentLinks,
}: {
  onClose: () => void
  styleLinks: NavLink[]
  instrumentLinks: NavLink[]
}) {
  const { t } = useTranslation()
  // Lock body scroll when drawer is open
  useEffect(() => {
    document.body.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
    }
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-50"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
        className="absolute right-0 top-0 h-full w-full max-w-sm bg-background border-l border-border shadow-stripe overflow-y-auto"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-border">
          <Link href="/" onClick={onClose}>
            <Image
              src="/large-color-logo.svg"
              alt="Latin Music Mastery"
              width={140}
              height={32}
              className="h-8 w-auto"
            />
          </Link>
          <button
            onClick={onClose}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label={t("nav.closeMenu")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Nav sections */}
        <nav className="flex flex-col">
          {/* Explore accordion */}
          <MobileAccordion title={t("nav.explore")}>
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("nav.byCountry")}
                </p>
                <div className="space-y-1">
                  {countries.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("nav.byStyle")}
                </p>
                <div className="space-y-1">
                  {styleLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {t("nav.byInstrument")}
                </p>
                <div className="space-y-1">
                  {instrumentLinks.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={onClose}
                      className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
                    >
                      <ChevronRight className="h-3 w-3 text-muted-foreground" />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </MobileAccordion>

          {/* Direct links */}
          <Link
            href="/pricing"
            onClick={onClose}
            className="border-b border-border px-4 py-4 text-base font-medium text-foreground hover:bg-muted transition-colors"
          >
            {t("nav.pricing")}
          </Link>
          <Link
            href="/instructors"
            onClick={onClose}
            className="border-b border-border px-4 py-4 text-base font-medium text-foreground hover:bg-muted transition-colors"
          >
            {t("nav.instructors")}
          </Link>

          {/* About accordion */}
          <MobileAccordion title={t("nav.about")}>
            <div className="space-y-1">
              {aboutLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onClose}
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground/80 hover:bg-muted hover:text-foreground transition-colors"
                >
                  <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  {t(item.labelKey)}
                </Link>
              ))}
            </div>
          </MobileAccordion>
        </nav>

        {/* Language toggle + Social links */}
        <div className="border-t border-border px-4 py-4 flex items-center justify-between">
          <LanguageToggle variant="labeled" />
        </div>
        <div className="border-t border-border px-4 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {t("common.followUs")}
          </p>
          <div className="flex items-center gap-3">
            {socialLinks.map((social) => (
              <a
                key={social.label}
                href={social.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={social.label}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary"
              >
                <social.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ */
/*  Dropdown Wrapper (desktop)                                         */
/* ------------------------------------------------------------------ */

function NavDropdown({
  label,
  children,
  openKey,
  activeKey,
  onOpen,
  onClose,
}: {
  label: string
  children: React.ReactNode
  openKey: string
  activeKey: string | null
  onOpen: (key: string) => void
  onClose: () => void
}) {
  const isOpen = activeKey === openKey
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleEnter = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    onOpen(openKey)
  }

  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => {
      onClose()
    }, 150)
  }

  return (
    <div
      className="relative"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        className={cn(
          "flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          isOpen
            ? "text-foreground"
            : "text-muted-foreground hover:text-foreground"
        )}
        onClick={() => (isOpen ? onClose() : onOpen(openKey))}
        aria-expanded={isOpen}
      >
        {label}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence>{isOpen && children}</AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ */
/*  Main Header                                                        */
/* ------------------------------------------------------------------ */

interface MarketingHeaderProps {
  instruments?: NavItem[]
  styles?: NavItem[]
}

export function MarketingHeader({ instruments = [], styles = [] }: MarketingHeaderProps = {}) {
  const { t } = useTranslation()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  // Build dropdown links from the DB catalog so slugs resolve to the real
  // /explore?instrument= / ?style= filtered pages.
  const instrumentLinks: NavLink[] = instruments.map((i) => ({
    label: i.name,
    href: `/explore?instrument=${encodeURIComponent(i.slug)}`,
  }))
  const styleLinks: NavLink[] = styles.map((s) => ({
    label: s.name,
    href: `/explore?style=${encodeURIComponent(s.slug)}`,
  }))

  // Track scroll for header background
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10)
    }
    handleScroll() // check initial position
    window.addEventListener("scroll", handleScroll, { passive: true })
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  const closeDropdown = useCallback(() => setActiveDropdown(null), [])
  const openDropdown = useCallback((key: string) => setActiveDropdown(key), [])

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-40 transition-all duration-300",
          scrolled
            ? "bg-background/80 backdrop-blur-xl border-b border-border shadow-stripe-sm"
            : "bg-transparent"
        )}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <Image
              src="/large-color-logo.svg"
              alt="Latin Music Mastery"
              width={160}
              height={36}
              className="h-9 w-auto"
              priority
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            <NavDropdown
              label={t("nav.explore")}
              openKey="explore"
              activeKey={activeDropdown}
              onOpen={openDropdown}
              onClose={closeDropdown}
            >
              <ExploreMegaMenu styleLinks={styleLinks} instrumentLinks={instrumentLinks} />
            </NavDropdown>

            <Link
              href="/pricing"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("nav.pricing")}
            </Link>

            <Link
              href="/instructors"
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              {t("nav.instructors")}
            </Link>

            <NavDropdown
              label={t("nav.about")}
              openKey="about"
              activeKey={activeDropdown}
              onOpen={openDropdown}
              onClose={closeDropdown}
            >
              <AboutDropdown />
            </NavDropdown>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Desktop social icons */}
            <div className="hidden md:flex items-center gap-1">
              {socialLinks.map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
                >
                  <social.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
            <LanguageToggle variant="labeled" className="hidden md:inline-flex" />
            <ThemeToggle />

            {/* Mobile hamburger */}
            <button
              className="md:hidden rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              onClick={() => setMobileOpen(true)}
              aria-label={t("nav.openMenu")}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <MobileDrawer
            onClose={() => setMobileOpen(false)}
            styleLinks={styleLinks}
            instrumentLinks={instrumentLinks}
          />
        )}
      </AnimatePresence>
    </>
  )
}
