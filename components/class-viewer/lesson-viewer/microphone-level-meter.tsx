'use client'

import { useTranslation } from '@/components/language-provider'

// Digital amplitude, not acoustic SPL. -1 dBFS is a headroom warning;
// only samples reaching full scale (0 dBFS) indicate digital clipping risk.
const FLOOR = -60
const WARNING = -1
export function amplitudeDbfs(amplitude: number) {
  return amplitude > 0 && Number.isFinite(amplitude) ? 20 * Math.log10(amplitude) : -Infinity
}
const position = (db: number) => Math.max(0, Math.min(100, (db - FLOOR) / -FLOOR * 100))

export function MicrophoneLevelMeter({ rms, peak, active }: { rms: number; peak: number; active: boolean }) {
  const { locale } = useTranslation()
  const es = locale === 'es'
  const levelDb = amplitudeDbfs(active ? rms : 0)
  const peakDb = amplitudeDbfs(active ? peak : 0)
  const warning = peakDb >= WARNING
  const clipped = peakDb >= 0
  const label = !active ? (es ? 'Micrófono apagado' : 'Microphone off') : clipped
    ? (es ? 'Límite digital alcanzado' : 'Digital limit reached') : warning
    ? (es ? 'Nivel muy alto' : 'Level too high') : (es ? 'Escuchando' : 'Listening')
  return <div className="w-full max-w-72 space-y-2 px-2 text-xs" data-mic-warning={warning}>
    <div className="flex items-center justify-between gap-2">
      <span className={warning ? 'font-semibold text-red-500' : 'text-muted-foreground'}>{label}</span>
      <output className={`tabular-nums ${warning ? 'text-red-500' : 'text-foreground'}`} aria-label={es ? 'Pico dBFS' : 'Peak dBFS'}>
        {Number.isFinite(peakDb) ? Math.min(0, peakDb).toFixed(1) : '−∞'} dBFS
      </output>
    </div>
    <div className="relative pt-5">
      <span className="absolute right-0 top-0 text-[10px] text-red-400">−1 dBFS</span>
      <div role="meter" aria-label={es ? 'Nivel del micrófono' : 'Microphone level'} aria-valuemin={FLOOR} aria-valuemax={0}
        aria-valuenow={Math.max(FLOOR, Math.min(0, levelDb))} aria-valuetext={`${label}; RMS ${Number.isFinite(levelDb) ? levelDb.toFixed(1) : '−∞'} dBFS`}
        className="relative h-4 overflow-hidden rounded bg-muted/60">
        <div className={`absolute inset-y-0 left-0 transition-[width] duration-75 ${warning ? 'bg-red-500' : 'bg-primary'}`} style={{ width: `${position(levelDb)}%` }} />
        {Number.isFinite(peakDb) && <span aria-hidden className={`absolute inset-y-0 w-0.5 ${warning ? 'bg-red-500' : 'bg-foreground'}`} style={{ left: `calc(${position(peakDb)}% - 2px)` }} />}
      </div>
      <span aria-hidden className="pointer-events-none absolute bottom-0 top-4 border-l border-dashed border-red-400" style={{ left: `${position(WARNING)}%` }} />
    </div>
    <div aria-hidden className="relative h-4 text-[10px] tabular-nums text-muted-foreground">
      {[-60, -30, -12, 0].map(db => <span key={db} className="absolute" style={{ left: `${position(db)}%`, transform: db === -60 ? undefined : db === 0 ? 'translateX(-100%)' : 'translateX(-50%)' }}>{db}</span>)}
    </div>
  </div>
}
