'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

interface CourseModeContextType {
  isCourseMode: boolean
  setCourseMode: (value: boolean) => void
}

const CourseModeContext = createContext<CourseModeContextType | null>(null)

export function CourseModeProvider({ children }: { children: ReactNode }) {
  const [isCourseMode, setIsCourseMode] = useState(false)

  return (
    <CourseModeContext.Provider value={{ isCourseMode, setCourseMode: setIsCourseMode }}>
      {children}
    </CourseModeContext.Provider>
  )
}

export function useCourseMode() {
  const context = useContext(CourseModeContext)
  if (!context) {
    throw new Error('useCourseMode must be used within a CourseModeProvider')
  }
  return context
}
