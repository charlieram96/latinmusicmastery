'use client'

import { useState } from 'react'
import Link from 'next/link'
import { login } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'

export default function LoginPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await login(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left Side - Image with Text Overlay */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Background Image */}
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?q=80&w=2070&auto=format&fit=crop')`,
          }}
        />
        {/* Dark Gradient Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-background/90 via-background/70 to-primary/30" />

        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          {/* Logo */}
          <Link href="/">
            <img
              src="/large-color-logo.svg"
              alt="Latin Music Mastery"
              className="h-8 w-auto"
            />
          </Link>

          {/* Text Content */}
          <div className="space-y-6">
            <h1 className="text-4xl xl:text-5xl font-bold font-heading leading-tight">
              Master the rhythms of
              <span className="text-primary"> Latin America</span>
            </h1>
            <p className="text-lg text-white/70 max-w-md">
              Join our community of musicians learning salsa, bossa nova, tango,
              and more from world-class instructors.
            </p>

            {/* Stats */}
            <div className="flex gap-8 pt-4">
              <div>
                <div className="text-2xl font-bold">150+</div>
                <div className="text-sm text-white/60">Video Lessons</div>
              </div>
              <div>
                <div className="text-2xl font-bold">8</div>
                <div className="text-sm text-white/60">Music Styles</div>
              </div>
              <div>
                <div className="text-2xl font-bold">4.9</div>
                <div className="text-sm text-white/60">Rating</div>
              </div>
            </div>
          </div>

          {/* Quote */}
          <div className="space-y-3">
            <p className="text-white/80 italic">
              "The best platform for learning authentic Latin American music.
              The instructors are incredible."
            </p>
            <p className="text-sm text-white/60">— Carlos R., Guitarist</p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <Link href="/">
              <img
                src="/large-color-logo.svg"
                alt="Latin Music Mastery"
                className="h-8 w-auto mx-auto"
              />
            </Link>
          </div>

          {/* Header */}
          <div className="text-center lg:text-left">
            <h2 className="text-3xl font-bold font-heading text-white">Welcome back</h2>
            <p className="mt-2 text-white/60">
              Sign in to continue your musical journey
            </p>
          </div>

          {/* Google Sign In */}
          <GoogleSignInButton />

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-white/10" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-4 text-white/40">
                Or continue with email
              </span>
            </div>
          </div>

          {/* Form */}
          <form action={handleSubmit} className="space-y-6">
            {error && (
              <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                disabled={loading}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-white/80">Password</Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:text-primary/80 transition-colors"
                >
                  Forgot password?
                </Link>
              </div>
              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={loading}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-primary focus:ring-primary"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white py-3 h-auto text-base font-semibold rounded-full"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {/* Sign Up Link */}
          <p className="text-center text-white/60">
            Don't have an account?{' '}
            <Link href="/signup" className="text-primary hover:text-primary/80 font-medium transition-colors">
              Sign up for free
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
