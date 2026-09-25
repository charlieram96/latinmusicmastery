// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const PARAMS = new URLSearchParams()
vi.mock('next/navigation', () => ({ usePathname: () => '/dashboard/course/son', useSearchParams: () => PARAMS }))
vi.mock('next/image', () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ alt }: { alt: string }) => <img alt={alt} />,
}))
vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import { PageLoadingProvider, usePageLoading } from '../page-loading-overlay'

let root: Root
let host: HTMLDivElement
function Probe() { return <span data-loading={String(usePageLoading().isLoading)} /> }

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const clickLink = (attrs: Record<string, string>) => {
  act(() => root.render(<PageLoadingProvider><a {...attrs}>go</a><Probe /></PageLoadingProvider>))
  const a = host.querySelector('a')!
  a.addEventListener('click', (e) => e.preventDefault())
  act(() => { a.click() })
  return host.querySelector('[data-loading]')!.getAttribute('data-loading') === 'true'
}

describe('page loading overlay', () => {
  it('shows the loader for an internal link', () => {
    expect(clickLink({ href: '/dashboard/courses' })).toBe(true)
  })

  it('skips a link marked data-no-page-loader (e.g. a tap that only opens a card)', () => {
    expect(clickLink({ href: '/dashboard/courses', 'data-no-page-loader': '' })).toBe(false)
  })
})
