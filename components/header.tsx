import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { UserNav } from '@/components/user-nav'

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
    <header className="absolute top-0 left-0 right-0 z-50 bg-transparent backdrop-blur-sm border-b border-white/10">
      <div className="container mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center">
            <img
              src="/white-logo.svg"
              alt="Latin Music Mastery"
              className="h-8 w-auto"
            />
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {user ? (
              <>
                <Link
                  href="/dashboard"
                  className="text-sm font-medium text-white/90 hover:text-white transition-colors"
                >
                  Dashboard
                </Link>
                <Link
                  href="/courses"
                  className="text-sm font-medium text-white/90 hover:text-white transition-colors"
                >
                  Courses
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className="text-sm font-medium text-white/90 hover:text-white transition-colors"
                  >
                    Admin
                  </Link>
                )}
              </>
            ) : (
              <>
                <Link
                  href="/#pricing"
                  className="text-sm font-medium text-white/90 hover:text-white transition-colors"
                >
                  Pricing
                </Link>
                <Link
                  href="/#instructors"
                  className="text-sm font-medium text-white/90 hover:text-white transition-colors"
                >
                  Instructors
                </Link>
                <Link
                  href="/#testimonials"
                  className="text-sm font-medium text-white/90 hover:text-white transition-colors"
                >
                  Testimonials
                </Link>
              </>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {user ? (
            <UserNav user={user} isAdmin={isAdmin} />
          ) : (
            <>
              <Button className="bg-white/10 text-white hover:bg-white/20 hover:text-white px-6 py-2 h-auto rounded-full font-semibold backdrop-blur-sm" asChild>
                <Link href="/login">Login</Link>
              </Button>
              <Button className="bg-white text-primary hover:bg-white/90 hover:text-primary px-6 py-2 h-auto rounded-full font-semibold" asChild>
                <Link href="/signup">Sign Up</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
