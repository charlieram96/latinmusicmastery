import { AdminText } from '@/components/admin/admin-text'
import { createClient } from '@/lib/supabase/server'
import { Mail } from 'lucide-react'
import { WaitlistList } from '@/components/admin/waitlist-list'

export default async function WaitlistPage() {
  const supabase = await createClient()

  const [entriesRes, instrumentsRes, stylesRes] = await Promise.all([
    supabase
      .from('waitlist')
      .select('id, email, created_at, instrument_ids, style_ids, expertise_level')
      .order('created_at', { ascending: false }),
    supabase.from('instruments').select('id, name').order('name'),
    supabase.from('musical_styles').select('id, name').order('name'),
  ])

  const entries = entriesRes.data ?? []
  const instruments = instrumentsRes.data ?? []
  const styles = stylesRes.data ?? []
  const total = entries.length

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight mb-1"><AdminText text={"Waitlist"} /></h1>
        <p className="text-muted-foreground"><AdminText text={"People who have signed up for early access"} /></p>
      </div>

      <div className="rounded-xl border bg-card p-5 inline-flex flex-col mb-8">
        <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10 mb-2">
          <Mail className="w-4 h-4 text-blue-500" />
        </div>
        <div className="text-3xl font-bold">{total}</div>
        <div className="text-sm text-muted-foreground"><AdminText text={"Signups"} /></div>
      </div>

      <WaitlistList
        entries={entries}
        instruments={instruments}
        styles={styles}
      />
    </div>
  )
}
