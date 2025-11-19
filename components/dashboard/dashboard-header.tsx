import { Bell } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { UserNav } from '@/components/user-nav'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'
import Link from 'next/link'
import { MobileSidebarTrigger } from '@/components/dashboard/mobile-sidebar-trigger'

export async function DashboardHeader() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, email, full_name')
    .eq('id', user.id)
    .single()

  return (
    <header className="fixed top-0 left-0 right-0 z-50 w-full border-b bg-background">
      <div className="flex h-[50px] items-center px-6 gap-4">
        {/* Mobile Menu Toggle */}
        <MobileSidebarTrigger />

        {/* Left side - Logo */}
        <Link href="/dashboard" className="flex items-center">
          <Image
            src="/black-logo.svg"
            alt="Latin Music Mastery"
            width={140}
            height={28}
            className="h-7 w-auto"
          />
        </Link>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side - Notifications & User */}
        <div className="flex items-center gap-3">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative h-9 w-9">
            <Bell className="h-5 w-5" />
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs"
            >
              3
            </Badge>
          </Button>

          {/* User Dropdown */}
          <UserNav
            user={user}
            isAdmin={profile?.is_admin || false}
          />
        </div>
      </div>
    </header>
  )
}
