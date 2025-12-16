'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signup } from '@/app/actions/auth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'

export default function SignupPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError(null)

    const result = await signup(formData)

    if (result?.error) {
      setError(result.error)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border">
        <CardHeader className="space-y-1">
          <div className="flex justify-center mb-4">
            <Link href="/">
              <img
                src="/large-color-logo.svg"
                alt="Latin Music Mastery"
                className="h-8 w-auto"
              />
            </Link>
          </div>
          <CardTitle className="text-2xl font-bold text-center text-foreground">Create Account</CardTitle>
          <CardDescription className="text-center">
            Start your journey with Latin Music Mastery
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-6">
          <GoogleSignInButton />

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>
        </CardContent>

        <form action={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-500">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="full_name" className="text-foreground">Full Name</Label>
              <Input
                id="full_name"
                name="full_name"
                type="text"
                placeholder="John Doe"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                placeholder="you@example.com"
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-foreground">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                disabled={loading}
                minLength={6}
              />
              <p className="text-xs text-muted-foreground">
                Must be at least 6 characters
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col space-y-4">
            <Button
              type="submit"
              className="w-full bg-primary hover:bg-primary/90 text-white rounded-full"
              disabled={loading}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </Button>
            <p className="text-sm text-center text-muted-foreground">
              Already have an account?{' '}
              <Link href="/login" className="text-primary hover:underline">
                Sign in
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
