// @vitest-environment jsdom
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'

// The player owns the box the "your turn" overlay must cover (its full-bleed
// workspace), so the stub renders whatever overlay it is handed inside a
// marked box and lets the test end the demo.
const restartVideo = vi.fn()
vi.mock('@/components/playsense-studio/player/playsense-studio-player', () => ({
  PlaysenseStudioPlayer: (props: { overlay?: React.ReactNode | ((ctx: { restart: () => void }) => React.ReactNode); onEnded?: () => void }) => (
    <div data-testid="player">
      <div data-testid="player-box">{typeof props.overlay === 'function' ? props.overlay({ restart: restartVideo }) : props.overlay}</div>
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
const endDemo = () => act(() => { host.querySelector<HTMLButtonElement>('[data-testid="end-demo"]')!.click() })
const button = (label: string) => host.querySelector<HTMLButtonElement>(`[data-testid="turn-cta"] button[aria-label="${label}"], [data-testid="turn-cta"] button[data-action="${label}"]`)!

function mount() {
  act(() => { root.render(<ExerciseView classItemId="c" videoUrl="v.mp4" score={score} tracks={[]} activeTimeMap={null} exercise={exercise} playerLayout="split" />) })
}

it('shows the your-turn call to action inside the player box once the demo ends', () => {
  mount()
  expect(cta()).toBeNull()
  endDemo()
  const overlay = cta()
  expect(overlay).not.toBeNull()
  expect(overlay!.closest('[data-testid="player-box"]')).not.toBeNull()
  act(() => { button('your-turn').click() })
  expect(host.querySelector('[data-testid="game"]')).not.toBeNull()
})

it('can be closed with its button, by clicking the backdrop, and with Escape', () => {
  mount()
  endDemo()
  act(() => { button('dashboard.classViewer.exercise.closeOverlay').click() })
  expect(cta()).toBeNull()
  endDemo()
  act(() => { cta()!.dispatchEvent(new MouseEvent('click', { bubbles: true })) })
  expect(cta()).toBeNull()
  endDemo()
  act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
  expect(cta()).toBeNull()
  expect(host.querySelector('[data-testid="game"]')).toBeNull()
})

it('offers to watch the teacher again, which restarts the video and closes', () => {
  mount()
  endDemo()
  act(() => { button('watch-again').click() })
  expect(restartVideo).toHaveBeenCalledOnce()
  expect(cta()).toBeNull()
})

it('in a lesson, puts the Watch message and Your turn in the action bar', async () => {
  const { LessonFrameProvider, useActionClaims } = await import('../lesson-mode/lesson-frame')
  function Lesson() {
    const claims = useActionClaims()
    const [bar, setBar] = React.useState<HTMLElement | null>(null)
    return <LessonFrameProvider value={{ actionHost: bar, topClaim: claims.top, claim: claims.claim, advance: () => {}, teacherName: 'Livan' }}>
      <ExerciseView classItemId="c" videoUrl="v.mp4" score={score} tracks={[]} activeTimeMap={null} exercise={exercise} playerLayout="split" teacherName="Livan" />
      <footer data-bar ref={setBar} />
    </LessonFrameProvider>
  }
  act(() => { root.render(<Lesson />) })
  const bar = host.querySelector('[data-bar]')!
  expect(bar.textContent).toContain('dashboard.classViewer.lessonMode.watch.title')
  expect(host.querySelector('.lx-action-inline')).toBeNull()
  act(() => { bar.querySelector<HTMLButtonElement>('[data-action="your-turn-bar"]')!.click() })
  expect(host.querySelector('[data-testid="game"]')).not.toBeNull()
})

it('outside a lesson, shows the Watch message and Your turn under the player', () => {
  mount()
  const inline = host.querySelector('.lx-action-inline')!
  expect(inline.textContent).toContain('dashboard.classViewer.lessonMode.watch.titleNoTeacher')
  act(() => { inline.querySelector<HTMLButtonElement>('[data-action="your-turn-bar"]')!.click() })
  expect(host.querySelector('[data-testid="game"]')).not.toBeNull()
})
