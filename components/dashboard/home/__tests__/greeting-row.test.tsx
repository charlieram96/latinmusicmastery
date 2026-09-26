// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/language-provider', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, string | number>) => (params ? `${key}(${Object.values(params).join(',')})` : key),
  }),
}))

import { GreetingRow } from '../greeting-row'

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const render = (weekDone: number, weekGoal = 6) =>
  act(() => root.render(<GreetingRow firstName="Ana" streak={3} weekDone={weekDone} weekGoal={weekGoal} />))

describe('GreetingRow weekly goal chip (D6)', () => {
  it('reads like the streak card: done of goal up to the goal', () => {
    render(4)
    expect(host.textContent).toContain('dashboard.pages.home.streak.goalProgress(4,6)')
  })

  it('caps at the goal and shows the extra lessons above it', () => {
    render(9)
    expect(host.textContent).toContain('dashboard.pages.home.streak.goalExceeded(6,3)')
    expect(host.textContent).not.toContain('(9,6)')
  })
})
