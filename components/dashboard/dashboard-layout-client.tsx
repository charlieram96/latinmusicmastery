'use client'

import { ReactNode, createContext, useContext, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Maximize, Minimize } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { LanguageToggle } from '@/components/language-toggle'
import './student-fullscreen.css'
import { usePathname } from 'next/navigation'
import { isLessonModePath } from '@/lib/dashboard/lesson-mode'

const ScreenControlHost = createContext<(host: HTMLDivElement | null) => void>(() => {})
/** The shared shell places its control in each surface's navigation row. */
export function StudentFullscreenSlot() {
  const register = useContext(ScreenControlHost)
  return <div ref={register} data-student-fullscreen-slot />
}

interface DashboardLayoutClientProps {
  children: ReactNode
  sidebar: ReactNode
  header: ReactNode
  mobileNav?: ReactNode
}

/**
 * Shell: fixed 64px rail on the left (it overlays the page when it expands),
 * fixed header on top, and a scrolling main region. `main` is the scroll
 * container on purpose: lesson pages rely on `sticky top-0` inside it.
 *
 * Lessons keep the global navigation and provide their own top bar and scroll container.
 */
export function DashboardLayoutClient({ children, sidebar, header, mobileNav }: DashboardLayoutClientProps) {
  const lessonMode = isLessonModePath(usePathname())
  const [controlHost, setControlHost] = useState<HTMLDivElement | null>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const { locale } = useTranslation()
  useEffect(() => {
    if (!fullscreen) return
    const exit = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !document.fullscreenElement) {
        setFullscreen(false)
        toggleRef.current?.focus()
      }
    }
    document.addEventListener('keydown', exit)
    return () => document.removeEventListener('keydown', exit)
  }, [fullscreen])
  const label = locale === 'es'
    ? (fullscreen ? 'Salir de pantalla completa' : 'Pantalla completa')
    : (fullscreen ? 'Exit full screen' : 'Full screen')
  const controls = <div className="student-screen-controls" data-score-preserve-selection>
    {fullscreen && <LanguageToggle variant="icon" />}
    <button ref={toggleRef} type="button" aria-label={label} title={label}
      aria-pressed={fullscreen} onClick={() => setFullscreen(value => !value)}>
      {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
    </button>
  </div>

  if (lessonMode) {
    return (
      <ScreenControlHost.Provider value={setControlHost}><div data-dashboard-shell data-student-fullscreen={fullscreen} data-lesson-mode className="h-dvh w-full overflow-hidden bg-background">
        {!fullscreen && controlHost ? createPortal(controls, controlHost) : controls}
        <div data-dashboard-navigation>{sidebar}</div>
        <div data-dashboard-frame className="h-full min-w-0 md:ml-16">{children}</div>
        <div data-dashboard-navigation>{mobileNav}</div>
      </div></ScreenControlHost.Provider>
    )
  }

  return (
    <ScreenControlHost.Provider value={setControlHost}><div data-dashboard-shell data-student-fullscreen={fullscreen} className="h-screen w-full overflow-hidden bg-background">
      {!fullscreen && controlHost ? createPortal(controls, controlHost) : controls}
        <div data-dashboard-navigation>{sidebar}</div>

      <div data-dashboard-frame className="flex h-screen flex-col md:ml-16">
        <div data-dashboard-header>{header}</div>

        <main data-dashboard-main className="flex-1 overflow-y-auto pt-[var(--header-h)]">
          <div data-dashboard-content className="p-6 pb-24 md:pb-6">{children}</div>
        </main>
      </div>

      <div data-dashboard-navigation>{mobileNav}</div>
    </div></ScreenControlHost.Provider>
  )
}
