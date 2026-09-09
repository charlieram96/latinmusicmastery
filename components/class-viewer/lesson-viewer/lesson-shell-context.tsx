'use client'

// Lets components nested deep inside the lesson viewer's RSC `body` slot
// control the shell's sidebar collapse state (which lives in LessonShell).
// Immersive exercise mode hides the sidebar independently, preserving this
// preference when the student returns to the lesson.

import { createContext, useContext, type ReactNode } from 'react'

interface LessonShellContextType {
  collapsed: boolean
  setCollapsed: (value: boolean) => void
}

const LessonShellContext = createContext<LessonShellContextType | null>(null)

export function LessonShellProvider({
  collapsed,
  setCollapsed,
  children,
}: LessonShellContextType & { children: ReactNode }) {
  return (
    <LessonShellContext.Provider value={{ collapsed, setCollapsed }}>
      {children}
    </LessonShellContext.Provider>
  )
}

/**
 * Read/control the lesson shell's sidebar. Returns a safe no-op default when
 * used outside a LessonShell so consumers don't have to guard for it.
 */
export function useLessonShell(): LessonShellContextType {
  return (
    useContext(LessonShellContext) ?? {
      collapsed: false,
      setCollapsed: () => {},
    }
  )
}
