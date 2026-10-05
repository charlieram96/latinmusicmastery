import { getServerLocale } from '@/lib/i18n/server'
import { localizeRow, INSTRUMENT_FIELDS, STYLE_FIELDS, COUNTRY_FIELDS } from '@/lib/i18n/localize'
import { instrumentLabel } from '@/lib/i18n/instruments'
import { AdminText } from '@/components/admin/admin-text'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Guitar, Globe, Music, Pencil, Trash2 } from 'lucide-react'
import { getInstruments, deleteInstrument } from '@/app/actions/admin'

export default async function InstrumentsPage() {
  const locale = await getServerLocale()
  const instruments = await getInstruments()
  for (const instrument of instruments) {
    localizeRow(instrument, locale, INSTRUMENT_FIELDS)
    instrument.name = instrumentLabel(instrument.name, locale)
    localizeRow(instrument.country, locale, COUNTRY_FIELDS)
    for (const relation of instrument.instrument_styles ?? []) {
      localizeRow(relation.style, locale, STYLE_FIELDS)
    }
  }

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-1"><AdminText text={"Instruments"} /></h1>
          <p className="text-muted-foreground"><AdminText text={"Link instruments to musical styles and countries"} /></p>
        </div>
        <Button asChild>
          <Link href="/admin/instruments/new">
            <Plus className="w-4 h-4 mr-2" /> <AdminText text={"Add Instrument"} /> </Link>
        </Button>
      </div>

      {/* Stat */}
      <div className="rounded-xl border bg-card p-5 inline-flex flex-col mb-8">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10 mb-2">
          <Guitar className="w-4 h-4 text-amber-500" />
        </div>
        <div className="text-3xl font-bold">{instruments.length}</div>
        <div className="text-sm text-muted-foreground"><AdminText text={"Instruments"} /></div>
      </div>

      {instruments.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {instruments.map((instrument: any) => {
            const styles = instrument.instrument_styles?.map((is: any) => is.style).filter(Boolean) || []
            return (
              <div
                key={instrument.id}
                className="rounded-xl border bg-card overflow-hidden hover:shadow-md transition-shadow"
              >
                {instrument.image_url && (
                  <div className="aspect-video overflow-hidden">
                    <img
                      src={instrument.image_url}
                      alt={instrument.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {!instrument.image_url && (
                  <div className="aspect-video bg-gradient-to-br from-amber-500/10 to-amber-500/5 flex items-center justify-center">
                    <Guitar className="w-10 h-10 text-amber-500/30" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-bold">{instrument.name}</h3>
                    {instrument.country && (
                      <Badge variant="outline" className="text-xs ml-2 flex-shrink-0">
                        <Globe className="w-2.5 h-2.5 mr-1" />
                        {instrument.country.name}
                      </Badge>
                    )}
                  </div>
                  {instrument.description && (
                    <p className="text-sm text-muted-foreground mb-3 line-clamp-2">{instrument.description}</p>
                  )}
                  {styles.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {styles.slice(0, 3).map((style: any) => (
                        <Badge key={style.id} variant="secondary" className="text-xs">
                          <Music className="w-2.5 h-2.5 mr-1" />
                          {style.name}
                        </Badge>
                      ))}
                      {styles.length > 3 && (
                        <Badge variant="secondary" className="text-xs">+{styles.length - 3}</Badge>
                      )}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground/60 mb-3 font-mono">/{instrument.slug}</p>
                  <div className="flex items-center gap-2">
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <Link href={`/admin/instruments/${instrument.id}`}>
                        <Pencil className="w-3.5 h-3.5 mr-1" /> <AdminText text={"Edit"} /> </Link>
                    </Button>
                    <form action={async () => {
                      'use server'
                      await deleteInstrument(instrument.id)
                    }}>
                      <Button variant="ghost" size="sm" type="submit" className="text-destructive hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </form>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="rounded-xl border bg-card p-12 text-center">
          <Guitar className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-muted-foreground text-sm mb-4"><AdminText text={"No instruments yet. Add instruments to link them to styles and countries."} /></p>
          <Button asChild>
            <Link href="/admin/instruments/new"><AdminText text={"Add Instrument"} /></Link>
          </Button>
        </div>
      )}
    </div>
  )
}
