// @vitest-environment jsdom
import React, { act, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { WorkspaceToolsPortal, WorkspaceToolsSlotProvider } from '../workspace-tools-slot'

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

function Page() {
  const [slot, setSlot] = useState<HTMLElement | null>(null)
  return <WorkspaceToolsSlotProvider host={slot}>
    <section data-pane><WorkspaceToolsPortal><button data-switcher>Layout</button></WorkspaceToolsPortal></section>
    <footer><div data-slot ref={setSlot} /></footer>
  </WorkspaceToolsSlotProvider>
}

it('moves the tools into the slot, once', () => {
  act(() => root.render(<Page />))
  expect(host.querySelectorAll('[data-switcher]')).toHaveLength(1)
  expect(host.querySelector('[data-slot] [data-switcher]')).not.toBeNull()
  expect(host.querySelector('[data-pane] [data-switcher]')).toBeNull()
})

it('renders the tools in place without a slot', () => {
  act(() => root.render(<WorkspaceToolsPortal><button data-switcher>Layout</button></WorkspaceToolsPortal>))
  expect(host.querySelector('[data-switcher]')).not.toBeNull()
})
