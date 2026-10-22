// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import { LearningModeAppearance, setLearningMode, useLearningMode } from '../store'
let root: Root
let host: HTMLDivElement
function Probe() { const mode = useLearningMode(); return <><LearningModeAppearance/><span>{mode}</span></> }
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  vi.stubEnv('NODE_ENV','development')
  localStorage.clear()
  host = document.createElement('div'); document.body.append(host); root=createRoot(host)
})
afterEach(() => {act(()=>root.unmount());host.remove();vi.unstubAllEnvs()})
it('defaults to classic; switching synchronizes appearance and preference without altering theme',()=>{
  document.documentElement.classList.add('dark')
  act(()=>root.render(<Probe/>))
  expect(host.textContent).toBe('classic')
  act(()=>setLearningMode('kids'))
  expect(document.documentElement.dataset.learningMode).toBe('kids')
  expect(localStorage.getItem('lmm-learning-mode')).toBe('kids')
  expect(document.documentElement.classList.contains('dark')).toBe(true)
  act(()=>setLearningMode('classic'))
  expect(document.documentElement.dataset.learningMode).toBe('classic')
})
it('uses the same saved learning mode in production',()=>{
  vi.stubEnv('NODE_ENV','production')
  localStorage.setItem('lmm-learning-mode','kids')
  act(()=>root.render(<Probe/>))
  expect(host.textContent).toBe('kids')
})
