import { createClient } from '@/lib/supabase/server'

export type WaitlistOption = { id: string; name: string }

export async function getWaitlistOptions(): Promise<{
  instruments: WaitlistOption[]
  styles: WaitlistOption[]
}> {
  const supabase = await createClient()

  const [{ data: instruments }, { data: styles }] = await Promise.all([
    supabase.from('instruments').select('id, name').order('name'),
    supabase.from('musical_styles').select('id, name').order('name'),
  ])

  return {
    instruments: instruments ?? [],
    styles: styles ?? [],
  }
}
