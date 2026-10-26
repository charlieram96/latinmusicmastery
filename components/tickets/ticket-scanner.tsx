'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AlertTriangle, Camera, CameraOff, CheckCircle2, Loader2, SwitchCamera, XCircle } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { isEntryOutcome, type ScanMode, type ScanOutcome } from '@/lib/tickets/scan-rules'
import type { ScanResponse, ScanStats } from '@/lib/tickets/scan'
import { cn } from '@/lib/utils'

interface TicketScannerProps {
  /** Admin scanner: the event to check in against (uses the admin session). */
  eventId?: string
  /** Staff scanner link token (event fixed by the link). */
  token?: string
  initialStats: ScanStats
}

type Detector = { detect: (source: CanvasImageSource) => Promise<Array<{ rawValue: string }>> }
type JsQr = (data: Uint8ClampedArray, width: number, height: number, options?: { inversionAttempts?: 'dontInvert' | 'attemptBoth' }) => { data: string } | null

interface Shown {
  outcome: ScanOutcome | 'error'
  ticket: ScanResponse['ticket']
  message?: string
  at: number
}

const T = 'tickets.scanner'
const SAME_CODE_MS = 4000
const RESUME_MS = 1300

async function createDetector(): Promise<Detector | null> {
  const BD = (window as unknown as { BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> } }).BarcodeDetector
  if (!BD) return null
  try {
    const supported = (await BD.getSupportedFormats?.()) ?? []
    if (supported.length && !supported.includes('qr_code')) return null
    const formats = ['qr_code', 'code_128'].filter((f) => !supported.length || supported.includes(f))
    return new BD({ formats })
  } catch {
    return null
  }
}

export function TicketScanner({ eventId, token, initialStats }: TicketScannerProps) {
  const { t, locale } = useTranslation()
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const loopRef = useRef<number | null>(null)
  // A request is in flight (blocks everything) / camera paused after a result.
  const inFlightRef = useRef(false)
  const cameraPausedRef = useRef(false)
  const lastRef = useRef<{ value: string; at: number }>({ value: '', at: 0 })
  const audioRef = useRef<AudioContext | null>(null)
  const [camera, setCamera] = useState<'off' | 'starting' | 'on' | 'denied' | 'unsupported'>('off')
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [deviceIndex, setDeviceIndex] = useState(0)
  const [mode, setMode] = useState<ScanMode>('checkin')
  const [stats, setStats] = useState<ScanStats>(initialStats)
  const [shown, setShown] = useState<Shown | null>(null)
  const [flash, setFlash] = useState<'good' | 'warn' | 'bad' | null>(null)
  const [manual, setManual] = useState('')
  const [sending, setSending] = useState(false)
  const [locked, setLocked] = useState<string | null>(null)
  const [history, setHistory] = useState<Shown[]>([])
  const modeRef = useRef(mode)
  useEffect(() => { modeRef.current = mode }, [mode])

  const headers = useCallback((): HeadersInit => ({ 'Content-Type': 'application/json', ...(token ? { 'x-scanner-token': token } : {}) }), [token])

  const feedback = useCallback((kind: 'good' | 'warn' | 'bad') => {
    navigator.vibrate?.(kind === 'good' ? 80 : [120, 60, 120])
    const ctx = audioRef.current
    if (!ctx) return
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = kind === 'good' ? 1180 : kind === 'warn' ? 520 : 220
    osc.type = kind === 'good' ? 'sine' : 'square'
    gain.gain.setValueAtTime(0.0001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.01)
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (kind === 'good' ? 0.16 : 0.32))
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + 0.35)
  }, [])

  const submit = useCallback(async (value: string) => {
    inFlightRef.current = true
    cameraPausedRef.current = true
    setSending(true)
    try {
      const res = await fetch('/api/tickets/scan', {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify({ value, mode: modeRef.current, eventId, locale }),
      })
      const data = (await res.json().catch(() => ({}))) as Partial<ScanResponse> & { error?: string }
      if (!res.ok) {
        if (res.status === 401 && data.error?.startsWith('link_')) setLocked(data.error)
        setShown({ outcome: 'error', ticket: null, message: data.error, at: Date.now() })
        setFlash('bad')
        feedback('bad')
        return
      }
      const outcome = data.outcome as ScanOutcome
      const entry: Shown = { outcome, ticket: data.ticket ?? null, at: Date.now() }
      setShown(entry)
      setHistory((h) => [entry, ...h].slice(0, 12))
      if (data.stats) setStats(data.stats)
      const kind = isEntryOutcome(outcome) ? 'good' : outcome === 'already_checked_in' ? 'warn' : 'bad'
      setFlash(kind)
      feedback(kind)
    } catch {
      setShown({ outcome: 'error', ticket: null, message: 'network', at: Date.now() })
      setFlash('bad')
      feedback('bad')
    } finally {
      setSending(false)
      inFlightRef.current = false
      window.setTimeout(() => { cameraPausedRef.current = false; setFlash(null) }, RESUME_MS)
    }
  }, [eventId, feedback, headers, locale])

  const onDetected = useCallback((value: string) => {
    const now = Date.now()
    if (inFlightRef.current || cameraPausedRef.current) return
    if (value === lastRef.current.value && now - lastRef.current.at < SAME_CODE_MS) return
    lastRef.current = { value, at: now }
    void submit(value)
  }, [submit])

  const stop = useCallback(() => {
    if (loopRef.current) window.clearTimeout(loopRef.current)
    loopRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCamera((c) => (c === 'on' || c === 'starting' ? 'off' : c))
  }, [])

  const start = useCallback(async (index = deviceIndex) => {
    if (!navigator.mediaDevices?.getUserMedia) return setCamera('unsupported')
    audioRef.current ??= new AudioContext()
    void audioRef.current.resume()
    stop()
    setCamera('starting')
    try {
      const list = devices.length ? devices : []
      const deviceId = list[index]?.deviceId
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
      })
      streamRef.current = stream
      const video = videoRef.current!
      video.srcObject = stream
      await video.play()
      setCamera('on')
      if (!list.length) {
        const all = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput')
        setDevices(all)
      }

      const detector = await createDetector()
      const jsQR: JsQr | null = detector ? null : ((await import('jsqr')).default as unknown as JsQr)
      const loop = async () => {
        if (!streamRef.current) return
        if (!inFlightRef.current && !cameraPausedRef.current && video.readyState >= 2 && video.videoWidth) {
          try {
            let value: string | null = null
            if (detector) {
              value = (await detector.detect(video))[0]?.rawValue ?? null
            } else if (jsQR) {
              const scale = Math.min(1, 720 / video.videoWidth)
              const w = Math.round(video.videoWidth * scale)
              const h = Math.round(video.videoHeight * scale)
              const canvas = (canvasRef.current ??= document.createElement('canvas'))
              canvas.width = w
              canvas.height = h
              const ctx = canvas.getContext('2d', { willReadFrequently: true })!
              ctx.drawImage(video, 0, 0, w, h)
              value = jsQR(ctx.getImageData(0, 0, w, h).data, w, h, { inversionAttempts: 'dontInvert' })?.data ?? null
            }
            if (value) onDetected(value)
          } catch {
            // A dropped frame is fine; keep scanning.
          }
        }
        loopRef.current = window.setTimeout(loop, 160)
      }
      void loop()
    } catch (error) {
      const name = (error as { name?: string })?.name
      setCamera(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'unsupported')
    }
  }, [deviceIndex, devices, onDetected, stop])

  // Resume automatically when camera access was already granted.
  useEffect(() => {
    let cancelled = false
    navigator.permissions?.query({ name: 'camera' as PermissionName }).then((p) => {
      if (!cancelled && p.state === 'granted') void start()
    }).catch(() => {})
    return () => { cancelled = true; stop() }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, [])

  // Keep the counter fresh when several doors scan at once.
  useEffect(() => {
    if (locked) return
    const id = window.setInterval(async () => {
      const query = eventId ? `?eventId=${eventId}` : ''
      const res = await fetch(`/api/tickets/scan${query}`, { headers: headers() }).catch(() => null)
      if (res?.ok) setStats(((await res.json()) as { stats: ScanStats }).stats)
      else if (res?.status === 401) setLocked('link_revoked')
    }, 20000)
    return () => window.clearInterval(id)
  }, [eventId, headers, locked])

  const switchCamera = () => {
    const next = (deviceIndex + 1) % Math.max(1, devices.length)
    setDeviceIndex(next)
    void start(next)
  }

  const submitManual = (e: React.FormEvent) => {
    e.preventDefault()
    if (!manual.trim() || inFlightRef.current) return
    lastRef.current = { value: manual.trim(), at: Date.now() }
    void submit(manual.trim())
    setManual('')
  }

  if (locked) {
    return (
      <div className="mx-auto grid max-w-md gap-3 rounded-2xl border bg-card p-8 text-center">
        <XCircle className="mx-auto h-10 w-10 text-destructive" />
        <p className="text-lg font-semibold">{t(`${T}.lockedTitle`)}</p>
        <p className="text-sm text-muted-foreground">{t(`${T}.locked.${locked}`)}</p>
      </div>
    )
  }

  const pct = stats.total ? Math.round((stats.checkedIn / stats.total) * 100) : 0
  const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale === 'es' ? 'es-US' : 'en-US', { hour: 'numeric', minute: '2-digit' }) : '')

  return (
    <div className="mx-auto grid w-full max-w-md gap-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="mb-2 flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">{stats.checkedIn}</span>
          <span className="text-muted-foreground">/ {stats.total} {t(`${T}.checkedIn`)}</span>
          <span className="ml-auto text-sm tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
      </div>

      <div className="relative aspect-square overflow-hidden rounded-3xl border bg-black">
        <video ref={videoRef} playsInline muted className={cn('h-full w-full object-cover', camera !== 'on' && 'invisible')} />
        {camera === 'on' && (
          <div aria-hidden className="pointer-events-none absolute inset-[14%] rounded-2xl border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.25)]" />
        )}
        {flash && (
          <div aria-hidden className={cn('pointer-events-none absolute inset-0 transition-opacity', flash === 'good' ? 'bg-success/45' : flash === 'warn' ? 'bg-warning/45' : 'bg-destructive/45')} />
        )}
        {camera !== 'on' && (
          <div className="absolute inset-0 grid place-items-center p-6 text-center text-white">
            <div className="grid justify-items-center gap-3">
              {camera === 'starting' ? <Loader2 className="h-8 w-8 animate-spin" /> : <Camera className="h-10 w-10 opacity-80" />}
              {camera === 'denied' && <p className="text-sm">{t(`${T}.cameraDenied`)}</p>}
              {camera === 'unsupported' && <p className="text-sm">{t(`${T}.cameraUnsupported`)}</p>}
              {camera !== 'starting' && (
                <Button size="lg" onClick={() => void start()}>{t(`${T}.start`)}</Button>
              )}
            </div>
          </div>
        )}
        {sending && <Loader2 className="absolute right-4 top-4 h-6 w-6 animate-spin text-white" aria-label={t(`${T}.checking`)} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="radiogroup" aria-label={t(`${T}.mode`)} className="flex rounded-xl border p-1">
          {(['checkin', 'verify'] as const).map((m) => (
            <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
              className={cn('rounded-lg px-3 py-1.5 text-sm font-medium', mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>
              {t(`${T}.modes.${m}`)}
            </button>
          ))}
        </div>
        {camera === 'on' && devices.length > 1 && (
          <Button variant="outline" size="sm" onClick={switchCamera}><SwitchCamera className="h-4 w-4" /> {t(`${T}.switch`)}</Button>
        )}
        {camera === 'on' && (
          <Button variant="ghost" size="sm" onClick={stop}><CameraOff className="h-4 w-4" /> {t(`${T}.stop`)}</Button>
        )}
      </div>

      <div aria-live="assertive" aria-atomic="true">
        {shown && <ResultCard shown={shown} time={time} t={t} />}
      </div>

      <form onSubmit={submitManual} className="flex gap-2">
        <Input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="LMM-XXXX-XXXX" aria-label={t(`${T}.manualLabel`)} autoCapitalize="characters" autoCorrect="off" spellCheck={false} />
        <Button type="submit" variant="outline" disabled={!manual.trim() || sending}>{t(`${T}.check`)}</Button>
      </form>

      {history.length > 1 && (
        <div className="rounded-2xl border bg-card p-4">
          <p className="mb-2 text-sm font-semibold">{t(`${T}.recent`)}</p>
          <ul className="grid gap-1.5 text-sm">
            {history.slice(1).map((h) => (
              <li key={h.at} className="flex items-center gap-2">
                <OutcomeIcon outcome={h.outcome} className="h-4 w-4 flex-shrink-0" />
                <span className="truncate">{h.ticket?.attendeeName || h.ticket?.ticketNumber || t(`${T}.outcomes.${h.outcome}`)}</span>
                <span className="ml-auto text-xs text-muted-foreground">{time(new Date(h.at).toISOString())}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function ResultCard({ shown, time, t }: { shown: Shown; time: (iso: string | null) => string; t: (key: string, params?: Record<string, string | number>) => string }) {
  const good = shown.outcome !== 'error' && isEntryOutcome(shown.outcome)
  const warn = shown.outcome === 'already_checked_in'
  return (
    <div className={cn('flex items-start gap-3 rounded-2xl border-2 p-4', good ? 'border-success bg-success/10' : warn ? 'border-warning bg-warning/10' : 'border-destructive bg-destructive/10')}>
      <OutcomeIcon outcome={shown.outcome} className="mt-0.5 h-8 w-8 flex-shrink-0" />
      <div className="min-w-0">
        <p className="text-xl font-bold">{t(`${T}.outcomes.${shown.outcome}`)}</p>
        {shown.ticket && (
          <>
            {shown.ticket.attendeeName && <p className="text-lg font-semibold">{shown.ticket.attendeeName}</p>}
            <p className="text-sm text-muted-foreground">{[shown.ticket.tierName, shown.ticket.ticketNumber].filter(Boolean).join(' · ')}</p>
            {warn && shown.ticket.checkedInAt && (
              <p className="mt-1 text-sm">{t(`${T}.firstScan`, { time: time(shown.ticket.checkedInAt), by: shown.ticket.checkedInBy ?? '—' })}</p>
            )}
          </>
        )}
        {shown.outcome === 'error' && <p className="text-sm text-muted-foreground">{t(`${T}.errorHint`)}</p>}
      </div>
    </div>
  )
}

function OutcomeIcon({ outcome, className }: { outcome: ScanOutcome | 'error'; className?: string }) {
  if (outcome !== 'error' && isEntryOutcome(outcome)) return <CheckCircle2 className={cn('text-success', className)} />
  if (outcome === 'already_checked_in') return <AlertTriangle className={cn('text-warning', className)} />
  return <XCircle className={cn('text-destructive', className)} />
}
