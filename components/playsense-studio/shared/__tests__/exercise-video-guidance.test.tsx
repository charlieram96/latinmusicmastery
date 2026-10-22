// @vitest-environment jsdom
import React, { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ locale: 'es' }) }))
vi.mock('../lesson-start-card', () => ({ LessonStartCard: ({ title, onStart }: {title:string;onStart:()=>void}) => <button onClick={onStart}>{title}</button> }))
vi.mock('@/components/class-viewer/lesson-viewer/coaching-card', () => ({ CoachingCard: () => null }))
import { ExerciseVideoGuidance } from '../exercise-video-guidance'
it('preserves media time on pause/play, and only restores the title when seeking to zero', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(function(this: HTMLMediaElement) { this.dispatchEvent(new Event('pause')) })
  const play = vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function(this: HTMLMediaElement) { this.dispatchEvent(new Event('play')); return Promise.resolve() })
  const host = document.createElement('div'), root = createRoot(host), ref = createRef<HTMLVideoElement>()
  try {
    await act(async () => root.render(<><video ref={ref}/><ExerciseVideoGuidance itemId="dba5d44e-9d9d-43d3-bf9d-aa5262356cac" videoRef={ref}/></>))
    expect(host.textContent).toContain('Cáscara')
    await act(async () => host.querySelector('button')!.click())
    const video=ref.current!
    await act(async () => { video.currentTime=8; video.dispatchEvent(new Event('timeupdate')); video.pause() })
    expect(video.currentTime).toBe(8)
    expect(host.textContent).not.toContain('Cáscara')
    await act(async () => video.play())
    expect(video.currentTime).toBe(8)
    await act(async () => { video.currentTime=0; video.dispatchEvent(new Event('seeked')) })
    expect(host.textContent).toContain('Cáscara')
  } finally { await act(async () => root.unmount()); pause.mockRestore(); play.mockRestore(); vi.unstubAllGlobals() }
})
