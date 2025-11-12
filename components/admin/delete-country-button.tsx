'use client'

import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteCountry } from '@/app/actions/admin'

interface DeleteCountryButtonProps {
  countryId: string
  countryName: string
}

export function DeleteCountryButton({ countryId, countryName }: DeleteCountryButtonProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${countryName}"? This will also delete all associated musical styles and courses.`)) {
      return
    }

    setIsLoading(true)
    try {
      const result = await deleteCountry(countryId)
      if (result.error) {
        alert(`Failed to delete: ${result.error}`)
      }
    } catch (error) {
      console.error('Error deleting country:', error)
      alert('An error occurred while deleting')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleDelete}
      disabled={isLoading}
      variant="destructive"
      size="sm"
    >
      <Trash2 className="w-4 h-4 mr-1" />
      {isLoading ? 'Deleting...' : 'Delete'}
    </Button>
  )
}
