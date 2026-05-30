import { ReactNode } from 'react'

interface LegalPageProps {
  title: string
  /** e.g. "May 21, 2026" — omit if the document has no separate effective date. */
  effectiveDate?: string
  lastUpdated: string
  children: ReactNode
}

/**
 * Shared shell + typography for the legal/policy pages (Terms, Privacy,
 * Accessibility). The marketing route group layout already provides the header
 * and footer, so this only renders the page body.
 *
 * The project has no @tailwindcss/typography plugin, so content styling is
 * applied via arbitrary child-element variants on the wrapper below.
 */
export function LegalPage({ title, effectiveDate, lastUpdated, children }: LegalPageProps) {
  return (
    <article>
      <section className="relative border-b border-border bg-gradient-to-b from-primary/5 via-background to-background py-16 md:py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h1 className="mb-4 text-3xl font-bold md:text-5xl">{title}</h1>
          <div className="space-y-1 text-sm text-muted-foreground">
            {effectiveDate && (
              <p>
                <span className="font-medium text-foreground">Effective Date:</span> {effectiveDate}
              </p>
            )}
            <p>
              <span className="font-medium text-foreground">Last Updated:</span> {lastUpdated}
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 md:py-16">
        <div
          className="
            mx-auto max-w-3xl px-4 sm:px-6 lg:px-8
            leading-relaxed text-muted-foreground
            [&_h2]:mt-12 [&_h2]:mb-4 [&_h2]:scroll-mt-24 [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:text-foreground
            [&_h3]:mt-8 [&_h3]:mb-3 [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-foreground
            [&_p]:mb-4
            [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:opacity-80
            [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-6
            [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:space-y-1.5 [&_ol]:pl-6
            [&_strong]:font-semibold [&_strong]:text-foreground
          "
        >
          {children}
        </div>
      </section>
    </article>
  )
}
