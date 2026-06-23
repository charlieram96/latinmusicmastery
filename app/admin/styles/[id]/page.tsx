import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft } from 'lucide-react'
import { createStyle, updateStyle } from '@/app/actions/admin'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function StyleFormPage({ params }: PageProps) {
  const { id } = await params
  const isNew = id === 'new'
  const supabase = await createClient()

  const [countriesResult, styleResult] = await Promise.all([
    supabase.from('countries').select('id, name').order('name'),
    isNew
      ? Promise.resolve({ data: null })
      : supabase.from('musical_styles').select('*').eq('id', id).single(),
  ])

  const countries = countriesResult.data ?? []
  const style = styleResult.data

  if (!isNew && !style) {
    notFound()
  }

  const action = isNew ? createStyle : updateStyle.bind(null, id)

  return (
    <div className="px-6 py-8">
      <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/admin/styles"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Styles
        </Link>
        <h1 className="text-3xl font-bold">
          {isNew ? 'Add Musical Style' : 'Edit Musical Style'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Style Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="country_id">Country *</Label>
              <select
                id="country_id"
                name="country_id"
                required
                defaultValue={style?.country_id ?? ''}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="" disabled>
                  Select a country...
                </option>
                {countries.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={style?.name || ''}
                placeholder="e.g., Salsa"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="name_es" className="text-muted-foreground">Name (Español)</Label>
              <Input
                id="name_es"
                name="name_es"
                defaultValue={style?.name_es || ''}
                placeholder="Nombre en español (opcional)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                name="slug"
                required
                defaultValue={style?.slug || ''}
                placeholder="e.g., salsa"
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly version (lowercase, no spaces). Must be unique per country.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={style?.description || ''}
                placeholder="Brief description of this musical style..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description_es" className="text-muted-foreground">Description (Español)</Label>
              <Textarea
                id="description_es"
                name="description_es"
                defaultValue={style?.description_es || ''}
                placeholder="Descripción en español (opcional)..."
                rows={4}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1">
                {isNew ? 'Create Style' : 'Update Style'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/styles">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
