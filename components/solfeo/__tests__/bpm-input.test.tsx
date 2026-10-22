// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { BpmInput } from '../bpm-input'

it('allows clearing and typing 60 digit by digit, validating only on commit', () => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  const host = document.createElement('div')
  document.body.append(host)
  const root = createRoot(host), onChange = vi.fn()
  act(() => root.render(<BpmInput value={100} onChange={onChange} />))
  const input = host.querySelector('input')!
  const type = (value: string) => act(() => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  type(''); type('6'); expect(input.value).toBe('6')
  type('60'); expect(onChange).not.toHaveBeenCalled()
  act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
  expect(onChange).toHaveBeenLastCalledWith(60)
  type('999')
  act(() => input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })))
  expect(onChange).toHaveBeenLastCalledWith(200)
  type('')
  act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })))
  expect(input.value).toBe('100')
  act(() => root.unmount()); host.remove()
})
