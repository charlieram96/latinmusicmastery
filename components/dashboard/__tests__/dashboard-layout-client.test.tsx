// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

let pathname = '/dashboard'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

import { DashboardLayoutClient } from '../dashboard-layout-client'

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const render = () => act(() => root.render(
  <DashboardLayoutClient sidebar={<nav data-rail />} header={<header data-top />} mobileNav={<div data-tabs />}>
    <p data-page>page</p>
  </DashboardLayoutClient>))

it('renders the rail, header and scrolling main on dashboard pages', () => {
  pathname = '/dashboard/course/c1'
  render()
  expect(host.querySelector('[data-rail]')).not.toBeNull()
  expect(host.querySelector('[data-top]')).not.toBeNull()
  expect(host.querySelector('[data-dashboard-main] [data-page]')).not.toBeNull()
  expect(host.querySelector('[data-lesson-mode]')).toBeNull()
})

it('renders a lesson full-bleed, without the rail, header or tab bar', () => {
  pathname = '/dashboard/course/c1/class/k1'
  render()
  expect(host.querySelector('[data-lesson-mode] [data-page]')).not.toBeNull()
  expect(host.querySelector('[data-rail]')).toBeNull()
  expect(host.querySelector('[data-top]')).toBeNull()
  expect(host.querySelector('[data-tabs]')).toBeNull()
  // The lesson provides its own scroll container.
  expect(host.querySelector('[data-dashboard-main]')).toBeNull()
})
