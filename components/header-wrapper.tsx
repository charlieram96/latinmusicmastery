'use client'

import { ReactNode, useEffect, useState } from 'react'

interface HeaderWrapperProps {
  children: ReactNode
}

export function HeaderWrapper({ children }: HeaderWrapperProps) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-background/80 backdrop-blur-md border-b border-white/10'
          : 'bg-transparent'
      }`}
    >
      {children}
    </header>
  )
}
