// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

let pathname = '/dashboard'
vi.mock('next/navigation', () => ({ usePathname: () => pathname }))

import { DashboardLayoutClient, StudentFullscreenSlot } from '../dashboard-layout-client'

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

it('keeps dashboard navigation beside the lesson without a duplicate header', () => {
  pathname = '/dashboard/course/c1/class/k1'
  render()
  expect(host.querySelector('[data-lesson-mode] [data-page]')).not.toBeNull()
  expect(host.querySelector('[data-rail]')).not.toBeNull()
  expect(host.querySelector('[data-top]')).toBeNull()
  expect(host.querySelector('[data-tabs]')).not.toBeNull()
  // The lesson provides its own scroll container.
  expect(host.querySelector('[data-dashboard-main]')).toBeNull()
})

it('expands without remounting content and restores navigation with Escape or the exit button', () => {
  pathname = '/dashboard/course/c1/class/k1'
  render()
  const page = host.querySelector('[data-page]')
  const button = host.querySelector('.student-screen-controls > button') as HTMLButtonElement
  act(() => button.click())
  expect(host.querySelector('[data-student-fullscreen="true"]')).not.toBeNull()
  expect(button.getAttribute('aria-label')).toBe('Exit full screen')
  expect(host.querySelector('[data-page]')).toBe(page)
  act(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })))
  expect(host.querySelector('[data-student-fullscreen="false"]')).not.toBeNull()
  expect(document.activeElement).toBe(button)
  act(() => button.click())
  act(() => button.click())
  expect(host.querySelector('[data-student-fullscreen="false"]')).not.toBeNull()
})


it('places the control in the shared navigation slot and keeps the exit visible when expanded', () => {
  pathname = '/dashboard/course/c1/class/k1'
  act(() => root.render(<DashboardLayoutClient sidebar={<nav />} header={<header />}>
    <header className="lx-top"><StudentFullscreenSlot /></header><p data-page>quiz</p>
  </DashboardLayoutClient>))
  const slot = host.querySelector('[data-student-fullscreen-slot]')!
  expect(slot.querySelector('button[aria-pressed]')).not.toBeNull()
  act(() => (slot.querySelector('button[aria-pressed]') as HTMLButtonElement).click())
  expect(slot.querySelector('button[aria-pressed]')).toBeNull()
  expect(host.querySelector('button[aria-label="Exit full screen"]')).not.toBeNull()
  act(() => (host.querySelector('button[aria-label="Exit full screen"]') as HTMLButtonElement).click())
  expect(slot.querySelector('button[aria-pressed]')).not.toBeNull()
})
