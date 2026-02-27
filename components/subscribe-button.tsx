'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'

interface SubscribeButtonProps {
  priceId: string
  planType: 'instrument' | 'all_access'
  instrument?: string
  label?: string
}

export function SubscribeButton({ priceId, planType, instrument, label }: SubscribeButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleSubscribe = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ priceId, planType, instrument }),
      })

      const data = await response.json()

      if (data.error) {
        console.error('Checkout error:', data.error)
        alert('Failed to start checkout. Please try again.')
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
      alert('An error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleSubscribe}
      disabled={isLoading}
      size="lg"
      className="w-full"
    >
      {isLoading ? 'Loading...' : (label || 'Subscribe Now')}
    </Button>
  )
}
