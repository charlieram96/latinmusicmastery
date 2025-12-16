'use client'

import { useEffect } from 'react'
import { useCourseMode } from '@/contexts/course-mode-context'

export function CourseModeActivator() {
  const { setCourseMode } = useCourseMode()

  useEffect(() => {
    setCourseMode(true)
    return () => setCourseMode(false)
  }, [setCourseMode])

  return null
}
