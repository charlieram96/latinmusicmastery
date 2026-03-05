import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft } from 'lucide-react'
import { createInstrument, updateInstrument } from '@/app/actions/admin'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function InstrumentFormPage({ params }: PageProps) {
  const { id } = await params
  const isNew = id === 'new'
  const supabase = await createClient()

  let instrument: any = null

  const [{ data: countries }, { data: styles }] = await Promise.all([
    supabase.from('countries').select('id, name').order('name'),
    supabase.from('musical_styles').select('id, name, country:countries(name)').order('name'),
  ])

  if (!isNew) {
    const { data } = await supabase
      .from('instruments')
      .select(`
        *,
        instrument_styles(style_id)
      `)
      .eq('id', id)
      .single()

    if (!data) notFound()
    instrument = data
  }

  const linkedStyleIds: string[] = instrument?.instrument_styles?.map((is: any) => is.style_id) || []
  const action = isNew ? createInstrument : updateInstrument.bind(null, id)

  return (
    <div className="p-6 lg:p-8 max-w-2xl mx-auto">
      <div className="mb-6">
        <Link
          href="/admin/instruments"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Instruments
        </Link>
        <h1 className="text-4xl font-black tracking-tight">
          {isNew ? 'Add Instrument' : 'Edit Instrument'}
        </h1>
      </div>

      <div className="rounded-xl border bg-card p-6">
        <form action={action} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={instrument?.name || ''}
              placeholder="e.g., Congas"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="slug">Slug *</Label>
            <Input
              id="slug"
              name="slug"
              required
              defaultValue={instrument?.slug || ''}
              placeholder="e.g., congas"
            />
            <p className="text-xs text-muted-foreground">URL-friendly version (lowercase, no spaces)</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              name="description"
              defaultValue={instrument?.description || ''}
              placeholder="Brief description of the instrument"
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="image_url">Image URL</Label>
            <Input
              id="image_url"
              name="image_url"
              type="url"
              defaultValue={instrument?.image_url || ''}
              placeholder="https://example.com/image.jpg"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="country_id">Country</Label>
            <select
              id="country_id"
              name="country_id"
              defaultValue={instrument?.country_id || ''}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">— No country —</option>
              {countries?.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Linked Musical Styles</Label>
            <p className="text-xs text-muted-foreground">Select all musical styles this instrument is associated with</p>
            <div className="rounded-lg border p-3 space-y-2 max-h-48 overflow-y-auto">
              {styles?.map((style: any) => (
                <label key={style.id} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    name="style_ids_checkbox"
                    value={style.id}
                    defaultChecked={linkedStyleIds.includes(style.id)}
                    className="rounded"
                  />
                  <span>{style.name}</span>
                  {style.country?.name && (
                    <span className="text-xs text-muted-foreground">({style.country.name})</span>
                  )}
                </label>
              ))}
            </div>
            {/* Hidden input — will be populated by the checkboxes via form submission */}
            {/* Since we can't use JS here, we collect style_ids via a comma-separated hidden input or use FormData directly */}
            <p className="text-xs text-muted-foreground">
              Note: Paste comma-separated style IDs below, or use the checkboxes above (JS required).
            </p>
            <Input
              id="style_ids"
              name="style_ids"
              defaultValue={linkedStyleIds.join(',')}
              placeholder="style-id-1,style-id-2"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1">
              {isNew ? 'Create Instrument' : 'Update Instrument'}
            </Button>
            <Button type="button" variant="outline" asChild>
              <Link href="/admin/instruments">Cancel</Link>
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
