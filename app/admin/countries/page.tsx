import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Plus, Pencil, Trash2 } from 'lucide-react'
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
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Countries</h1>
          <p className="text-muted-foreground">
            Manage Latin American countries
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/countries/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Country
          </Link>
        </Button>
      </div>

      {countries && countries.length > 0 ? (
        <div className="grid gap-4">
          {countries.map((country: any) => (
            <Card key={country.id}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-1">{country.name}</h3>
                  <p className="text-sm text-muted-foreground mb-2">
                    {country.description || 'No description'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Slug: {country.slug} • {country.musical_styles?.length || 0} styles
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/countries/${country.id}`}>
                      <Pencil className="w-4 h-4 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  <DeleteCountryButton countryId={country.id} countryName={country.name} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Countries</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              You haven't added any countries yet. Start by adding your first country.
            </p>
            <Button asChild>
              <Link href="/admin/countries/new">Add Country</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
