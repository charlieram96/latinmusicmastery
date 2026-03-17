import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { UserNav } from '@/components/user-nav'
import { HeaderWrapper } from '@/components/header-wrapper'
import { ThemeToggle } from '@/components/theme-toggle'

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
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Courses
            </Link>
            <Link
              href="/#instructors"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Instructors
            </Link>
            <Link
              href="/#testimonials"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Testimonials
            </Link>
            <Link
              href="/#pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
          </div>

          {/* CTAs - right */}
          <div className="flex items-center gap-3">
            <ThemeToggle />
            {user ? (
              <>
                <Button
                  variant="ghost"
                  className="text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
                  asChild
                >
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    className="text-sm text-muted-foreground hover:text-foreground hover:bg-muted"
                    asChild
                  >
                    <Link href="/admin">Admin</Link>
                  </Button>
                )}
                <UserNav user={user} isAdmin={isAdmin} />
              </>
            ) : null}
          </div>
        </nav>
      </div>
    </HeaderWrapper>
  )
}
