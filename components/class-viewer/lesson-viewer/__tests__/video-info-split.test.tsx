// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/components/class-viewer/tiptap-read-only', () => ({ TiptapReadOnly: () => null }))

import { VideoInfoSplit } from '../video-info-split'

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.stubGlobal('localStorage', { getItem: () => null, setItem() {} })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
  vi.unstubAllGlobals()
})

it('puts the video in the workspace media region and offers side and stack only', () => {
  act(() => {
    root.render(<VideoInfoSplit videoUrl="v.mp4" title="T" description="About" richContent={null} durationSeconds={90} bpm={null} keySignature={null} />)
  })
  expect(host.querySelector('.ws-media video')).not.toBeNull()
  expect(host.querySelector('.ws-music')!.textContent).toContain('About')
  const options = [...host.querySelectorAll('[role="group"] button')].map(b => b.getAttribute('aria-label'))
  expect(options).toEqual(['lessonWorkspace.side', 'lessonWorkspace.stack', 'lessonWorkspace.swap'])
})
