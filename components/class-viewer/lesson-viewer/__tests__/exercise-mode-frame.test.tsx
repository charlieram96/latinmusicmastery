// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('next/image', () => ({ default: () => null }))

import { ExerciseModeFrame } from '../exercise-mode-frame'
import { LessonFrameProvider } from '../lesson-mode/lesson-frame'

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    const box = this.hasAttribute('data-dashboard-main') ? { top: 60, bottom: 900 } : { top: 100, bottom: 400 }
    return { ...box, left: 0, right: 800, width: 800, height: box.bottom - box.top, x: 0, y: box.top, toJSON() {} } as DOMRect
  })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove(); vi.restoreAllMocks(); vi.unstubAllGlobals() })

describe('ExerciseModeFrame in the lesson stage (L5)', () => {
  it('fits the stage exactly, leaving the stage’s bottom padding and no more', () => {
    Object.defineProperty(window, 'innerHeight', { value: 1000, configurable: true })
    act(() => root.render(
      <div data-lesson-shell>
        <main data-dashboard-main>
          <div className="lx-fill" style={{ paddingBottom: '24px' }}>
            <LessonFrameProvider value={{ actionHost: null, topClaim: null, claim: () => {}, advance: () => {}, teacherName: null }}>
              <ExerciseModeFrame title="Tumbao" hasScore preview={false}><div /></ExerciseModeFrame>
            </LessonFrameProvider>
          </div>
        </main>
      </div>))
    const frame = host.querySelector<HTMLElement>('.ps-exercise-mode')!
    expect(frame.style.getPropertyValue('--lesson-exercise-height')).toBe(`${900 - 100 - 24}px`)
  })
})
