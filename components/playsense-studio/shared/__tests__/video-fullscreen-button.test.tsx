// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { describe, expect, it, vi } from 'vitest';
import { VideoFullscreenButton } from '../video-fullscreen-button';
vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ locale: 'es' }) }));
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
describe('video fullscreen', () => {
  it('enters the video surface and exits with the button or Escape', async () => {
    let active: Element | null = null;
    Object.defineProperty(document, 'fullscreenElement', { configurable: true, get: () => active });
    Object.defineProperty(document, 'exitFullscreen', { configurable: true, value: vi.fn(async () => { active = null; document.dispatchEvent(new Event('fullscreenchange')); }) });
    const host = document.createElement('div'); document.body.append(host);
    const root = createRoot(host);
    await act(async () => { root.render(<div><video /><VideoFullscreenButton /></div>); });
    const surface = host.firstElementChild!;
    Object.defineProperty(surface, 'requestFullscreen', { value: vi.fn(async () => { active = surface; document.dispatchEvent(new Event('fullscreenchange')); }) });
    const button = host.querySelector('button')!;
    try {
      await act(async () => { button.click(); });
      expect(active).toBe(surface);
      expect(button.getAttribute('aria-label')).toBe('Salir de pantalla completa');
      await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
      expect(active).toBeNull();
      expect(button.getAttribute('aria-label')).toBe('Pantalla completa');
      await act(async () => { button.click(); });
      await act(async () => { button.click(); });
      expect(active).toBeNull();
    } finally {
      await act(async () => root.unmount()); host.remove();
      Reflect.deleteProperty(document, 'fullscreenElement');
      Reflect.deleteProperty(document, 'exitFullscreen');
    }
  });
});
