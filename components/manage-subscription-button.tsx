'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'

export function ManageSubscriptionButton() {
  const [isLoading, setIsLoading] = useState(false)
  const { t } = useTranslation()

  const handleManage = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('/api/create-portal-session', {
        method: 'POST',
      })

      const data = await response.json()

      if (data.error) {
        console.error('Portal error:', data.error)
        alert(t('dashboard.pages.subscription.portalError'))
        return
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Error creating portal session:', error)
      alert(t('dashboard.pages.subscribe.errors.generic'))
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
      {isLoading ? t('common.loading') : t('dashboard.pages.subscription.manage')}
    </Button>
  )
}
