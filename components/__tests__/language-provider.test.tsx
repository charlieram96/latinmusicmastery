// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
const refresh = vi.hoisted(() => vi.fn())
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))
vi.mock('@/lib/supabase/client', () => ({ createClient: () => ({ auth: { getUser: () => new Promise(() => {}) } }) }))
import { LanguageProvider, useTranslation } from '../language-provider'
it('refreshes immediately despite a pending profile request and follows the server locale', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  localStorage.setItem('preferred_language', 'en')
  const host = document.createElement('div'), root = createRoot(host)
  function Control() { const { locale, setLocale } = useTranslation(); return <button onClick={() => setLocale('es')}>{locale}</button> }
  try {
    act(() => root.render(<LanguageProvider initialLocale="en"><Control /></LanguageProvider>))
    act(() => host.querySelector('button')!.click())
    expect(refresh).toHaveBeenCalledOnce()
    expect(document.cookie).toContain('preferred_language=es')
    act(() => root.render(<LanguageProvider initialLocale="es"><Control /></LanguageProvider>))
    expect(host.textContent).toBe('es')
    expect(document.documentElement.lang).toBe('es')
  } finally { act(() => root.unmount()); localStorage.clear() }
})
