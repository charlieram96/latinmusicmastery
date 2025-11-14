'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signInWithGoogle() {
  const supabase = await createClient()
  console.log("NEXT_PUBLIC_APP_URL", process.env.NEXT_PUBLIC_APP_URL);

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback`,
    },
  })

  if (error) {
    console.error('Error signing in with Google:', error)
    return { error: error.message }
  }

  if (data.url) {
    redirect(data.url)
  }
}
