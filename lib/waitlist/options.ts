import { createClient } from '@/lib/supabase/server'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeRows, INSTRUMENT_FIELDS, STYLE_FIELDS } from '@/lib/i18n/localize'

export type WaitlistOption = { id: string; name: string }

export async function getWaitlistOptions(): Promise<{
  instruments: WaitlistOption[]
  styles: WaitlistOption[]
}> {
  const supabase = await createClient()
  const locale = await getServerLocale()

  const [{ data: instruments }, { data: styles }] = await Promise.all([
    supabase.from('instruments').select('id, name, name_es').order('name'),
    supabase.from('musical_styles').select('id, name, name_es').order('name'),
  ])

  // Display names only — the form submits ids, so localizing is safe.
  localizeRows(instruments as Record<string, unknown>[] | null, locale, INSTRUMENT_FIELDS)
  localizeRows(styles as Record<string, unknown>[] | null, locale, STYLE_FIELDS)

  return {
    instruments: (instruments ?? []).map(({ id, name }) => ({ id, name })),
    styles: (styles ?? []).map(({ id, name }) => ({ id, name })),
  }
}
