'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { deleteTeacher } from '@/app/actions/admin'

interface DeleteTeacherButtonProps {
  teacherId: string
  teacherName: string
  courseCount: number
}

export function DeleteTeacherButton({ teacherId, teacherName, courseCount }: DeleteTeacherButtonProps) {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(false)

  const handleDelete = async () => {
    const warning = courseCount > 0
      ? `"${teacherName}" is assigned to ${courseCount} ${courseCount === 1 ? 'course' : 'courses'}. Deleting will unassign them. Continue?`
      : `Are you sure you want to delete "${teacherName}"?`

    if (!confirm(warning)) return

    setIsLoading(true)
    try {
      const result = await deleteTeacher(teacherId)
      if (result?.error) {
        alert(`Failed to delete: ${result.error}`)
        return
      }
      router.refresh()
    } catch (error) {
      console.error('Error deleting teacher:', error)
      alert('An error occurred while deleting')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      onClick={handleDelete}
      disabled={isLoading}
      variant="ghost"
      size="sm"
      className="h-8 text-destructive hover:text-destructive hover:bg-destructive/10"
    >
      <Trash2 className="w-3.5 h-3.5" />
      <span className="sr-only">Delete {teacherName}</span>
    </Button>
  )
}
