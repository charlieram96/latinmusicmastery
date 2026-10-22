// @vitest-environment jsdom
import { act, createRef } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ locale: 'es' }) }))
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ open, children }: any) => open ? children : null,
  DialogContent: ({ children }: any) => <div>{children}</div>,
  DialogTitle: ({ children }: any) => <h1>{children}</h1>,
  DialogDescription: ({ children }: any) => <p>{children}</p>,
}))
vi.mock('../../shared/video-watermark', () => ({ VideoWatermark: () => null, videoPictureBounds: () => ({ x: 0, y: 0, width: 100, height: 100 }) }))
import { EffectsPlayer, VideoEffectsPreview } from '../video-effects-preview'

afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
it('shows the title before countdown, warns on the actual last round, then completes', async () => {
  vi.useFakeTimers()
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(function(this: HTMLMediaElement) { this.dispatchEvent(new Event('play')); return Promise.resolve() })
  const host = document.createElement('div'); document.body.append(host)
  const root = createRoot(host)
  try {
    await act(async () => root.render(<VideoEffectsPreview videoUrl="/test.mp4" title="Cáscara con Sobao Simple" onOpen={() => {}} showSobao />))
    const click = async (text: string) => { const button = [...host.querySelectorAll('button')].find(b => b.textContent?.includes(text))!; await act(async () => button.click()) }
    await click('Probar efectos')
    expect(host.textContent).toContain('Cáscara con Sobao Simple')
    expect(host.querySelector<HTMLButtonElement>('button[aria-label="Reproducir"]')!.disabled).toBe(false)
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Reproducir"]')!.click())
    expect(host.textContent).toContain('PREPÁRATE')
    for (let i = 0; i < 3; i++) await act(async () => { vi.advanceTimersByTime(1000) })
    expect(host.textContent).toContain('VUELTA 1 / 5')
    const video = host.querySelector('video')!
    await act(async () => { video.currentTime = 16; video.dispatchEvent(new Event('timeupdate')) })
    expect(host.textContent).toContain('Vuelta 5/5')
    expect(host.textContent).toContain('VUELTA 5 / 5')
    expect(host.textContent).toContain('ÚLTIMA VUELTA')
    expect(host.textContent).not.toContain('¡Bien hecho!')
    await act(async () => { video.dispatchEvent(new Event('ended')) })
    expect(host.textContent).toContain('¡Bien hecho!')
    expect(host.textContent).toContain('Sin evaluación del desempeño')
    await click('Repetir ejercicio')
    await act(async () => video.dispatchEvent(new Event('seeked')))
    expect(video.currentTime).toBe(0)
    expect(host.textContent).toContain('Cáscara con Sobao Simple')
    expect(host.textContent).not.toContain('PREPÁRATE')
    await click('Comenzar')
    for (let i = 0; i < 3; i++) await act(async () => { vi.advanceTimersByTime(1000) })
    await act(async () => { video.currentTime = 8; video.dispatchEvent(new Event('timeupdate')) })
    await act(async () => (host.querySelector('button[aria-label="Pausar"]') as HTMLButtonElement).click())
    expect(video.currentTime).toBe(8)
    expect(host.textContent).not.toContain('Cáscara con Sobao Simple')
    await act(async () => (host.querySelector('button[aria-label="Reproducir"]') as HTMLButtonElement).click())
    expect(video.currentTime).toBe(8)
    await act(async () => host.querySelector<HTMLButtonElement>('button[aria-label="Reiniciar"]')!.click())
    expect(host.textContent).toContain('Cáscara con Sobao Simple')
  } finally { await act(async () => root.unmount()); host.remove() }
})

it('uses the editor video ref for duration and waveform seeking inline', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })
  vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => {})
  const host = document.createElement('div')
  const root = createRoot(host)
  const videoRef = createRef<HTMLVideoElement>()
  const onDuration = vi.fn()
  try {
    await act(async () => root.render(<EffectsPlayer videoUrl="/test.mp4" es showSobao title="Cáscara con Sobao Simple" videoRef={videoRef} onDuration={onDuration} preview={false} />))
    const video = host.querySelector('video')!
    expect(videoRef.current).toBe(video)
    expect(host.textContent).not.toContain('Probar efectos')
    Object.defineProperty(video, 'duration', { value: 22 })
    await act(async () => video.dispatchEvent(new Event('loadedmetadata')))
    expect(onDuration).toHaveBeenCalledWith(22)
    const seek = host.querySelector('[role="slider"]')!
    const move = async (key: string, times: number) => { for (let i = 0; i < times; i++) await act(async () => { seek.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true })) }) }
    await move('ArrowRight', 19)
    expect(video.currentTime).toBe(19)
    expect(host.textContent).toContain('Mano izquierda · Sobao')
    expect(host.textContent).toContain('Mano derecha · Cáscara')
    expect(host.textContent).toContain('VUELTA 5 / 5')
    expect(seek.getAttribute('aria-valuenow')).toBe('19')
    await move('ArrowLeft', 11)
    expect(video.currentTime).toBe(8)
    expect(host.textContent).toContain('VUELTA 3 / 5')
    expect(host.textContent).not.toContain('Mano izquierda · Sobao')
  } finally { await act(async () => root.unmount()) }
})
