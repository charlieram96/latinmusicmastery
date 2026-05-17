import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { PlaysenseStudioSandbox } from './sandbox-client';

// PlaySense Studio M2 sandbox.
// Gated: in production, requires admin. In development, open to anyone with a
// session so we can iterate quickly. This route is in the (dev) route group
// so the URL stays clean: /playsense-studio-sandbox.

export const dynamic = 'force-dynamic';

export default async function PlaysenseStudioSandboxPage() {
  if (process.env.NODE_ENV === 'production') {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) redirect('/login');

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    if (!profile?.is_admin) redirect('/dashboard');
  }

  return <PlaysenseStudioSandbox />;
}
