// Service-role Supabase client. Bypasses RLS — use ONLY in server-side
// routes/actions that have already authenticated/authorised the caller (admin
// re-check, Stripe webhook signature, etc.). Never import from client code.

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

let adminInstance: ReturnType<typeof createClient<Database>> | null = null

export function getSupabaseAdmin() {
  if (!adminInstance) {
    adminInstance = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    )
  }
  return adminInstance
}
