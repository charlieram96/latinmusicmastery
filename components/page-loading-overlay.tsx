'use client'

import { createContext, useContext, useState, useEffect, useRef, useCallback, Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { useTranslation } from '@/components/language-provider'

interface LoadingContextType {
  isLoading: boolean
  startLoading: () => void
}

const LoadingContext = createContext<LoadingContextType>({
  isLoading: false,
  startLoading: () => {}
})

function RouteChangeComplete({ onComplete }: { onComplete: () => void }) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const isFirstRender = useRef(true)

  useEffect(() => {
    // Skip the first render
    if (isFirstRender.current) {
      isFirstRender.current = false
      return
    }
    // Route has changed, hide the loader
    onComplete()
  }, [pathname, searchParams, onComplete])

  return null
}

function PageLoadingOverlay() {
  const { isLoading } = useContext(LoadingContext)
  const { t } = useTranslation()

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-md transition-opacity duration-150 ${
        isLoading ? 'opacity-100' : 'opacity-0 pointer-events-none'
      }`}
      aria-hidden={!isLoading}
    >
      <Image
        src="/logo-solo-white.svg"
        alt={t('common.loading')}
        width={120}
        height={90}
        className="animate-pulse"
        priority
      />
    </div>
  )
}

export function PageLoadingProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(false)
  const pathname = usePathname()
  const pathnameRef = useRef(pathname)

  const startLoading = useCallback(() => {
    setIsLoading(true)
  }, [])

  const stopLoading = useCallback(() => {
    setIsLoading(false)
  }, [])

  // Intercept all link clicks to show loading immediately
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const anchor = target.closest('a')

      if (!anchor) return

      const href = anchor.getAttribute('href')
      if (!href) return

      // The link handles this click itself without navigating (e.g. a first tap
      // on a lesson path node only opens its card). This listener runs in the
      // capture phase, before the link can preventDefault, so it has to be told.
      if (anchor.hasAttribute('data-no-page-loader')) return

      // Skip external links, hash links, and same-page links
      if (
        href.startsWith('http') ||
        href.startsWith('#') ||
        href.startsWith('mailto:') ||
        href.startsWith('tel:') ||
        anchor.target === '_blank'
      ) {
        return
      }

      // Skip if it's the same route
      if (href === pathnameRef.current) {
        return
      }

      // Show loading immediately
      setIsLoading(true)
    }

    // Update pathname ref
    pathnameRef.current = pathname

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [pathname])

  // Safety timeout to hide loader if route change takes too long
  useEffect(() => {
    if (isLoading) {
      const timeout = setTimeout(() => {
        setIsLoading(false)
      }, 3000)
      return () => clearTimeout(timeout)
    }
  }, [isLoading])

  return (
    <LoadingContext.Provider value={{ isLoading, startLoading }}>
      <Suspense fallback={null}>
        <RouteChangeComplete onComplete={stopLoading} />
      </Suspense>
      {children}
      <PageLoadingOverlay />
    </LoadingContext.Provider>
  )
}

// Export hook for manual loading control if needed
export function usePageLoading() {
  return useContext(LoadingContext)
}
