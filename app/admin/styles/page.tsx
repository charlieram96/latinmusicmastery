import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Music, BookOpen, Globe } from 'lucide-react'

export default async function StylesPage() {
  const supabase = await createClient()

  const { data: styles } = await supabase
    .from('musical_styles')
    .select(`
      *,
      country:countries(name, slug),
      courses(id)
    `)
    .order('name')

  // Group by country for display
  const byCountry = new Map<string, any[]>()
  styles?.forEach((style: any) => {
    const country = style.country?.name || 'Unknown'
    if (!byCountry.has(country)) byCountry.set(country, [])
    byCountry.get(country)!.push(style)
  })

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-1">Musical Styles</h1>
          <p className="text-muted-foreground">Manage musical styles by country</p>
        </div>
        <Button asChild>
          <Link href="/admin/styles/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Style
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="flex gap-4 mb-8">
        <div className="rounded-xl border bg-card p-5 inline-flex flex-col">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/10 mb-2">
            <Music className="w-4 h-4 text-purple-500" />
          </div>
          <div className="text-3xl font-bold">{styles?.length || 0}</div>
          <div className="text-sm text-muted-foreground">Musical Styles</div>
        </div>
        <div className="rounded-xl border bg-card p-5 inline-flex flex-col">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 mb-2">
            <Globe className="w-4 h-4 text-blue-500" />
          </div>
          <div className="text-3xl font-bold">{byCountry.size}</div>
          <div className="text-sm text-muted-foreground">Countries</div>
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
                {countryStyles.map((style: any) => (
                  <div key={style.id} className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold">{style.name}</h3>
                      <div className="flex gap-1.5 ml-2">
                        <Badge variant="outline" className="text-xs">
                          <BookOpen className="w-2.5 h-2.5 mr-1" />
                          {style.courses?.length || 0}
                        </Badge>
                      </div>
                    </div>
                    {style.description && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{style.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground/60 font-mono">/{style.slug}</span>
                      <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                        <Link href={`/admin/styles/${style.id}`}>Edit</Link>
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Music className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground text-sm mb-4">No styles yet. Add musical styles to organize your courses.</p>
          <Button asChild>
            <Link href="/admin/styles/new">Add Style</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
