// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

// The player owns the box the "your turn" overlay must cover (its full-bleed
// workspace), so the stub renders whatever overlay it is handed inside a
// marked box and lets the test end the demo.
vi.mock('@/components/playsense-studio/player/playsense-studio-player', () => ({
  PlaysenseStudioPlayer: (props: { overlay?: React.ReactNode; onEnded?: () => void }) => (
    <div data-testid="player">
      <div data-testid="player-box">{props.overlay}</div>
      <button type="button" data-testid="end-demo" onClick={props.onEnded}>end</button>
    </div>
  ),
}))
vi.mock('../score-exercise-game', () => ({ ScoreExerciseGame: () => <div data-testid="game" /> }))
vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  motion: new Proxy({}, { get: (_t, tag: string) => (props: Record<string, unknown>) => {
    const { initial: _i, animate: _a, exit: _e, transition: _t, children, ...rest } = props
    return React.createElement(tag, rest, children as React.ReactNode)
  } }),
}))

import { ExerciseView } from '../exercise-view'

let root: Root
let host: HTMLDivElement
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(async () => {
  await act(async () => root.unmount())
  host.remove()
})

const score = { schemaVersion: 1, title: 'T', sourceFormat: 'native', initialTempo: 120,
  initialTimeSignature: [4, 4], initialKeyFifths: 0, tracks: [] } as never
const exercise = { id: 'x', title: 'x', bpm: 120, timeSignature: [4, 4], tracks: [], loopCount: 1 } as never

const cta = () => host.querySelector('[data-testid="turn-cta"]')

it('shows the your-turn call to action inside the player box once the demo ends', () => {
  act(() => { root.render(<ExerciseView classItemId="c" videoUrl="v.mp4" score={score} tracks={[]} activeTimeMap={null} exercise={exercise} playerLayout="split" />) })
  expect(cta()).toBeNull()
  act(() => { host.querySelector<HTMLButtonElement>('[data-testid="end-demo"]')!.click() })
  const overlay = cta()
  expect(overlay).not.toBeNull()
  expect(overlay!.closest('[data-testid="player-box"]')).not.toBeNull()
  act(() => { overlay!.querySelector('button')!.click() })
  expect(host.querySelector('[data-testid="game"]')).not.toBeNull()
})
