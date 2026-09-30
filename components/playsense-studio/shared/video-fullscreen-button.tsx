'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';
import { useTranslation } from '@/components/language-provider';

type SafariVideo = HTMLVideoElement & { webkitEnterFullscreen?: () => void };

/** Mount directly inside the video surface so branding stays in fullscreen. */
export function VideoFullscreenButton({ getSurface, inline = false }: { getSurface?: () => HTMLElement | null; inline?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [error, setError] = useState(false);
  const { locale } = useTranslation();
  const es = locale === 'es';
  useEffect(() => {
    const surface = getSurface ? getSurface() : ref.current?.parentElement;
    if (!surface) return;
    surface.classList.add('lmm-fullscreen-surface');
    const sync = () => {
      setFullscreen(document.fullscreenElement === surface);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && document.fullscreenElement === surface) {
        event.stopPropagation();
        void document.exitFullscreen().catch(() => {});
      }
    };
    document.addEventListener('fullscreenchange', sync);
    document.addEventListener('keydown', escape, true);
    return () => {
      surface.classList.remove('lmm-fullscreen-surface');
      document.removeEventListener('fullscreenchange', sync);
      document.removeEventListener('keydown', escape, true);
    };
  }, [getSurface]);
  const toggle = async () => {
    const surface = getSurface ? getSurface() : ref.current?.parentElement;
    if (!surface) return;
    setError(false);
    try {
      if (document.fullscreenElement === surface) await document.exitFullscreen();
      else if (surface.requestFullscreen) await surface.requestFullscreen();
      else {
        const video = surface.querySelector('video') as SafariVideo | null;
        if (video?.webkitEnterFullscreen) video.webkitEnterFullscreen();
        else setError(true);
      }
    } catch { setError(true); }
  };
  const label = fullscreen ? (es ? 'Salir de pantalla completa' : 'Exit fullscreen') : (es ? 'Pantalla completa' : 'Fullscreen');
  return <>
    <button ref={ref} type="button" data-ws-nodrag aria-label={label} title={label} aria-pressed={fullscreen}
      onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); void toggle(); }}
      className={inline ? "st-iconbtn shrink-0" : "absolute right-2 top-2 z-30 grid h-9 w-9 place-items-center rounded-md bg-black/45 text-white backdrop-blur-sm transition hover:bg-primary hover:text-primary-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"}>
      {fullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
    </button>
    {error && <span role="status" className="absolute right-2 top-12 z-30 rounded bg-black/80 p-2 text-xs text-white">{es ? 'No se pudo abrir la pantalla completa.' : 'Could not open fullscreen.'}</span>}
  </>;
}
