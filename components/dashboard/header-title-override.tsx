'use client'

import { useEffect } from 'react'
import { setHeaderOverride } from '@/components/dashboard/header-title-store'

/** Renders nothing; while mounted, the dashboard header shows `title` instead of the section name. */
export function HeaderTitleOverride({ title }: { title: string }) {
  useEffect(() => {
    setHeaderOverride({ title })
    return () => setHeaderOverride(null)
  }, [title])
  return null
}
