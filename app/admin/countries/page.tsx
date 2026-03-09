import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Globe, Music, Pencil } from 'lucide-react'
import { DeleteCountryButton } from '@/components/admin/delete-country-button'

export default async function CountriesPage() {
  const supabase = await createClient()

  const { data: countries } = await supabase
    .from('countries')
    .select(`
      *,
      musical_styles(id)
    `)
    .order('name')

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-black tracking-tight mb-1">Countries</h1>
          <p className="text-muted-foreground">Manage Latin American countries</p>
        </div>
        <Button asChild>
          <Link href="/admin/countries/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Country
          </Link>
        </Button>
      </div>

      {/* Stat */}
      <div className="rounded-xl border bg-card p-5 inline-flex flex-col mb-8">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 mb-2">
          <Globe className="w-4 h-4 text-blue-500" />
        </div>
        <div className="text-3xl font-bold">{countries?.length || 0}</div>
        <div className="text-sm text-muted-foreground">Countries</div>
      </div>

      {countries && countries.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {countries.map((country: any) => (
            <div
              key={country.id}
              className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
            >
              {country.image_url && (
                <div className="aspect-video overflow-hidden">
                  <img
                    src={country.image_url}
                    alt={country.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              {!country.image_url && (
                <div className="aspect-video bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                  <Globe className="w-10 h-10 text-primary/30" />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-base">{country.name}</h3>
                  <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
                    <Music className="w-2.5 h-2.5 mr-1" />
                    {country.musical_styles?.length || 0} styles
                  </Badge>
                </div>
                {country.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{country.description}</p>
                )}
                <p className="text-xs text-muted-foreground/60 mb-3 font-mono">/{country.slug}</p>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/admin/countries/${country.id}`}>
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  <DeleteCountryButton countryId={country.id} countryName={country.name} />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Globe className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground text-sm mb-4">No countries yet. Start by adding your first country.</p>
          <Button asChild>
            <Link href="/admin/countries/new">Add Country</Link>
          </Button>
        </div>
      )}
    </div>
  )
}
