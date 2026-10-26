'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Re-render the order page while Stripe confirms the payment (up to ~2 min). */
export function PendingRefresh({ intervalMs = 3000, maxTries = 40 }: { intervalMs?: number; maxTries?: number }) {
  const router = useRouter()
  useEffect(() => {
    let tries = 0
    const id = window.setInterval(() => {
      tries += 1
      router.refresh()
      if (tries >= maxTries) window.clearInterval(id)
    }, intervalMs)
    return () => window.clearInterval(id)
  }, [router, intervalMs, maxTries])
  return null
}
