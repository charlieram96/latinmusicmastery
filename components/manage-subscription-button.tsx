'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

export function ManageSubscriptionButton() {
  const [isLoading, setIsLoading] = useState(false)

  const handleManage = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.error) {
        console.error('Portal error:', data.error)
        alert('Failed to open customer portal. Please try again.')
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Error creating portal session:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleManage}
      disabled={isLoading}
      variant="outline"
      className="w-full"
    >
      {isLoading ? 'Loading...' : 'Manage Subscription'}
    </Button>
  )
}
