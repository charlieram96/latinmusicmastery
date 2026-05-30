import { randomUUID } from 'crypto'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft } from 'lucide-react'
import { createCountry, updateCountry } from '@/app/actions/admin'
import { CountryImageUpload } from '@/components/admin/country-image-upload'

interface PageProps {
  params: Promise<{
    id: string
  }>
}

export default async function CountryFormPage({ params }: PageProps) {
  const { id } = await params
  const isNew = id === 'new'

  let country = null

  if (!isNew) {
    const supabase = await createClient()
    const { data } = await supabase
      .from('countries')
      .select('*')
      .eq('id', id)
      .single()

    if (!data) {
      notFound()
    }

    country = data
  }

  const action = isNew ? createCountry : updateCountry.bind(null, id)
  const uploadId = country?.id ?? randomUUID()

  return (
    <div className="px-6 py-8">
      <div className="max-w-2xl">
      <div className="mb-6">
        <Link
          href="/admin/countries"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Countries
        </Link>
        <h1 className="text-3xl font-bold">
          {isNew ? 'Add Country' : 'Edit Country'}
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Country Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form action={action} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                required
                defaultValue={country?.name || ''}
                placeholder="e.g., Puerto Rico"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                name="slug"
                required
                defaultValue={country?.slug || ''}
                placeholder="e.g., puerto-rico"
              />
              <p className="text-xs text-muted-foreground">
                URL-friendly version (lowercase, no spaces)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={country?.description || ''}
                placeholder="Brief description of the country's musical heritage"
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Image</Label>
              <CountryImageUpload
                countryId={uploadId}
                currentImageUrl={country?.image_url ?? null}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <Button type="submit" className="flex-1">
                {isNew ? 'Create Country' : 'Update Country'}
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/admin/countries">Cancel</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  )
}
