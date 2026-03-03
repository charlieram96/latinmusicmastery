import { createClient } from '@/lib/supabase/server'
import { HeaderNotificationsClient } from './header-notifications'

export async function HeaderNotifications({ userId }: { userId: string }) {
  const supabase = await createClient()

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(20)

  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false)

  return (
    <HeaderNotificationsClient
      notifications={notifications || []}
      unreadCount={unreadCount || 0}
    />
  )
}
