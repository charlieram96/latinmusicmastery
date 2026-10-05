import { getServerLocale } from '@/lib/i18n/server'
import { localizeRow, localizeRows, COURSE_FIELDS, STYLE_FIELDS, COUNTRY_FIELDS } from '@/lib/i18n/localize'
import { AdminText } from '@/components/admin/admin-text'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Music, BookOpen, Globe } from 'lucide-react'
import { DeleteStyleButton } from '@/components/admin/delete-style-button'

export default async function StylesPage() {
  const locale = await getServerLocale()
  const supabase = await createClient()

  const { data: styles } = await supabase
    .from('musical_styles')
    .select(`
      *,
      country:countries(name, name_es, slug),
      courses(id, title, title_es)
    `)
    .order('name')

  for (const style of styles ?? []) {
    localizeRow(style, locale, STYLE_FIELDS)
    localizeRow(style.country, locale, COUNTRY_FIELDS)
    localizeRows(style.courses, locale, COURSE_FIELDS)
  }

  // Group by country for display
  const byCountry = new Map<string, any[]>()
  styles?.forEach((style: any) => {
    const country = style.country?.name || (locale === 'es' ? 'Sin país' : 'Unknown')
    if (!byCountry.has(country)) byCountry.set(country, [])
    byCountry.get(country)!.push(style)
  })

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-1"><AdminText text={"Musical Styles"} /></h1>
          <p className="text-muted-foreground"><AdminText text={"Manage musical styles by country"} /></p>
        </div>
        <Button asChild>
          <Link href="/admin/styles/new">
            <Plus className="w-4 h-4 mr-2" /> <AdminText text={"Add Style"} /> </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-8">
        <div className="rounded-xl border bg-card p-5 inline-flex flex-col">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/10 mb-2">
            <Music className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold">{styles?.length || 0}</div>
          <div className="text-sm text-muted-foreground"><AdminText text={"Musical Styles"} /></div>
        </div>
        <div className="rounded-xl border bg-card p-5 inline-flex flex-col">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 mb-2">
            <Globe className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold">{byCountry.size}</div>
          <div className="text-sm text-muted-foreground"><AdminText text={"Countries"} /></div>
        </div>
      </div>

      {styles && styles.length > 0 ? (
        <div className="space-y-6">
          {Array.from(byCountry.entries()).map(([country, countryStyles]) => (
            <div key={country}>
              <div className="flex items-center gap-2 mb-3">
                <Globe className="w-3.5 h-3.5 text-muted-foreground" />
                <h2 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">{country}</h2>
                <div className="flex-1 h-px bg-border" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {countryStyles.map((style: any) => {
                  const courses: { id: string; title: string }[] = style.courses || []
                  const courseCount = courses.length
                  return (
                    <div key={style.id} className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-bold">{style.name}</h3>
                        <div className="flex gap-1.5 ml-2">
                          <Badge variant="outline" className="text-xs">
                            <BookOpen className="w-2.5 h-2.5 mr-1" />
                            {courseCount}
                          </Badge>
                        </div>
                      </div>
                      {style.description && (
                        <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{style.description}</p>
                      )}
                      {courseCount > 0 && (
                        <div className="mb-3 flex flex-wrap gap-1">
                          {courses.slice(0, 3).map((c) => (
                            <Link
                              key={c.id}
                              href={`/admin/courses/${c.id}`}
                              title={c.title}
                              className="inline-flex max-w-[140px] truncate rounded-md border bg-secondary/40 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            >
                              {c.title}
                            </Link>
                          ))}
                          {courseCount > 3 && (
                            <Link
                              href={`/admin/courses?style=${style.id}`}
                              className="inline-flex rounded-md border bg-secondary/40 px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            >
                              +{courseCount - 3} <AdminText text={"more"} /> </Link>
                          )}
                        </div>
                      )}
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground/60 font-mono">/{style.slug}</span>
                        <div className="flex items-center gap-1">
                          <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                            <Link href={`/admin/styles/${style.id}`}><AdminText text={"Edit"} /></Link>
                          </Button>
                          <DeleteStyleButton
                            styleId={style.id}
                            styleName={style.name}
                            courseCount={courseCount}
                          />
                        </div>
                      </div>
                      {courseCount > 0 && (
                        <p className="mt-2 text-[11px] text-muted-foreground"> <AdminText text={"To delete, first"} />{' '}
                          <Link
                            href={`/admin/courses?style=${style.id}`}
                            className="underline underline-offset-2 hover:text-foreground"
                          > <AdminText text={"reassign or delete the"} /> {courseCount} <AdminText text={"course"} />{courseCount === 1 ? '' : 's'}
                          </Link>
                          .
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground text-sm mb-4"><AdminText text={"No styles yet. Add musical styles to organize your courses."} /></p>
          <Button asChild>
            <Link href="/admin/styles/new"><AdminText text={"Add Style"} /></Link>
          </Button>
        </div>
      )}
    </div>
  )
}
