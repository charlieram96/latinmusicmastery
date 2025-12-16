import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { UserNav } from '@/components/user-nav'
import { HeaderWrapper } from '@/components/header-wrapper'

export async function Header() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Get user profile if logged in
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single()
    isAdmin = profile?.is_admin || false
  }

  return (
    <HeaderWrapper>
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <nav className="flex items-center justify-between h-16 lg:h-20">
          {/* Logo - left */}
          <Link href="/" className="flex-shrink-0">
            <img
              src="/large-color-logo.svg"
              alt="Latin Music Mastery"
              className="h-7 w-auto"
            />
          </Link>

          {/* Nav Links - center (hidden mobile) */}
          <div className="hidden md:flex items-center gap-8">
            <Link
              href="/#courses"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Courses
            </Link>
            <Link
              href="/#instructors"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Instructors
            </Link>
            <Link
              href="/#testimonials"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Testimonials
            </Link>
            <Link
              href="/#pricing"
              className="text-sm text-white/70 hover:text-white transition-colors"
            >
              Pricing
            </Link>
          </div>

          {/* CTAs - right */}
          <div className="flex items-center gap-3">
            {user ? (
              <>
                <Button
                  variant="ghost"
                  className="text-sm text-white/80 hover:text-white hover:bg-white/10"
                  asChild
                >
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    className="text-sm text-white/80 hover:text-white hover:bg-white/10"
                    asChild
                  >
                    <Link href="/admin">Admin</Link>
                  </Button>
                )}
                <UserNav user={user} isAdmin={isAdmin} />
              </>
            ) : (
              <>
                <Button
                  variant="ghost"
                  className="text-sm text-white/80 hover:text-white hover:bg-white/10"
                  asChild
                >
                  <Link href="/login">Login</Link>
                </Button>
                <Button
                  className="bg-primary hover:bg-primary/90 text-white rounded-full px-5 py-2 text-sm font-medium"
                  asChild
                >
                  <Link href="/signup">Get Started</Link>
                </Button>
              </>
            )}
          </div>
        </nav>
      </div>
    </HeaderWrapper>
  )
}
