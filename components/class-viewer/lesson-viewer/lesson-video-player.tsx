'use client'

// Polished, custom-skinned video player for lesson videos that have no notation.
//
// Native <video controls> is replaced with our own warm-dark control bar:
// play/pause, a scrubber with buffered range + hover-scrub preview + loop A/B
// markers, time read-out, volume, a playback-speed menu, loop A/B, and
// fullscreen. Keyboard shortcuts mirror the on-screen controls.
//
// Transport state (play/seek/rate/loop) is delegated to the shared
// useVideoTransportClock so behavior matches the PlaySense Studio player.

import { useSpacePlayback } from '@/hooks/use-space-playback'
import { VideoWatermark } from '@/components/playsense-studio/shared/video-watermark';
import {useVideoClickTrack} from '@/components/playsense-studio/player/state/use-video-click-track';
import {lessonMetronomeGrid,type LessonMetronome} from '@/lib/playsense-studio/lesson-metronome';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import {
  Play,
  Pause,
  Volume2,
  Volume1,
  VolumeX,
  Maximize,
  Minimize,
  Gauge,
  Repeat,
  RotateCcw,
  Captions,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/components/language-provider'
import { useVideoTransportClock } from '@/components/playsense-studio/player/state/use-video-transport-clock'
import { useSubtitleTracks } from '@/components/playsense-studio/player/state/use-subtitle-tracks'
import type { SubtitleLang, SubtitleTrackDef } from '@/lib/subtitles/srt-to-vtt'
import { lessonAudioTracks } from '@/lib/audio/lesson-audio'
import { useDubbedAudio } from './use-dubbed-audio'

interface LessonVideoPlayerProps {
  src: string
  metronome?: LessonMetronome
  poster?: string
  className?: string
  subtitles?: SubtitleTrackDef[]
  defaultSubtitleLang?: SubtitleLang
  /**
   * Usable region of the video, set by an admin with the trim handles in the
   * studio. Playback starts at trimIn and stops at trimOut, and the scrubber's
   * domain is remapped so the trimmed-away parts are simply not reachable.
   * Handled here rather than in useVideoTransportClock, which is shared with
   * the studio and the exercise player.
   */
  trimInSeconds?: number
  trimOutSeconds?: number | null
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2]

function fmt(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = Math.floor(seconds % 60)
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m)
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export function LessonVideoPlayer({
  src,
  metronome,
  poster,
  className,
  subtitles,
  defaultSubtitleLang,
  trimInSeconds,
  trimOutSeconds,
}: LessonVideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const { t, locale } = useTranslation()
  const clock = useVideoTransportClock(videoRef)
  const [clickOn,setClickOn]=useState(true)
  useVideoClickTrack({videoRef,grid:lessonMetronomeGrid(metronome??{bpm:120,anchorSeconds:null},clock.durationSeconds),enabled:clickOn&&metronome?.anchorSeconds!=null,volume:.2})
  const tracks = subtitles ?? []
  const { activeLang, setActiveLang } = useSubtitleTracks(videoRef, tracks, defaultSubtitleLang)

  const [hasPlayed, setHasPlayed] = useState(false)
  const [volume, setVolume] = useState(1)
  const [muted, setMuted] = useState(false)
  const audioTracks = lessonAudioTracks(src)
  const dubbedAudio = useDubbedAudio(videoRef, audioTracks, volume, muted)
  const [buffered, setBuffered] = useState(0)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [controlsVisible, setControlsVisible] = useState(true)
  const [speedOpen, setSpeedOpen] = useState(false)
  const [captionsOpen, setCaptionsOpen] = useState(false)
  const [hoverPct, setHoverPct] = useState<number | null>(null)
  const [scrubbing, setScrubbing] = useState(false)

  const mediaDuration = clock.durationSeconds || 0
  const trimStart = Math.max(0, trimInSeconds ?? 0)
  const trimEnd =
    trimOutSeconds != null && trimOutSeconds > trimStart
      ? Math.min(trimOutSeconds, mediaDuration || trimOutSeconds)
      : mediaDuration
  const trimmed = trimStart > 0 || (trimOutSeconds != null && trimOutSeconds < mediaDuration)

  // Everything the controls show is RELATIVE to the usable region, so a trimmed
  // lesson reads as a video of exactly that length.
  const duration = Math.max(0, trimEnd - trimStart)
  const positionSeconds = Math.max(0, clock.currentSeconds - trimStart)
  const playedPct = duration > 0 ? (positionSeconds / duration) * 100 : 0

  // Start at the in-point rather than at zero.
  const seekedToStartRef = useRef(false)
  useEffect(() => {
    if (!trimmed || seekedToStartRef.current || mediaDuration <= 0) return
    seekedToStartRef.current = true
    if (clock.currentSeconds < trimStart) clock.seek(trimStart)
  }, [trimmed, mediaDuration, trimStart, clock])

  // Stop at the out-point.
  useEffect(() => {
    if (!trimmed || !clock.isPlaying || trimEnd <= 0) return
    if (clock.currentSeconds >= trimEnd) {
      clock.pause()
      clock.seek(trimEnd)
    }
  }, [trimmed, clock, clock.isPlaying, clock.currentSeconds, trimEnd])

  // --- buffered range tracking ---
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onProgress = () => {
      try {
        if (video.buffered.length > 0) {
          setBuffered(video.buffered.end(video.buffered.length - 1))
        }
      } catch {
        /* buffered can throw before metadata */
      }
    }
    video.addEventListener('progress', onProgress)
    video.addEventListener('timeupdate', onProgress)
    return () => {
      video.removeEventListener('progress', onProgress)
      video.removeEventListener('timeupdate', onProgress)
    }
  }, [])

  // --- fullscreen state sync ---
  useEffect(() => {
    const onFs = () => setIsFullscreen(document.fullscreenElement === containerRef.current)
    document.addEventListener('fullscreenchange', onFs)
    return () => document.removeEventListener('fullscreenchange', onFs)
  }, [])

  // --- volume → element ---
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    video.volume = volume
    video.muted = muted || dubbedAudio.language !== 'original'
  }, [volume, muted, dubbedAudio.language])

  // --- auto-hide controls while playing ---
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bumpControls = useCallback(() => {
    setControlsVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => {
      if (clock.isPlaying && !speedOpen && !captionsOpen) setControlsVisible(false)
    }, 2600)
  }, [clock.isPlaying, speedOpen, captionsOpen])

  useEffect(() => {
    if (!clock.isPlaying) setControlsVisible(true)
    else bumpControls()
  }, [clock.isPlaying, bumpControls])

  const firstPlay = () => {
    setHasPlayed(true)
    void clock.play()
  }

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement === el) void document.exitFullscreen()
    else void el.requestFullscreen?.()
  }, [])

  const toggleMute = useCallback(() => setMuted((m) => !m), [])

  // --- scrubbing on the timeline ---
  const trackRef = useRef<HTMLDivElement | null>(null)
  const pctFromEvent = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return 0
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
  }
  const seekToPct = (pct: number) => clock.seek(trimStart + pct * duration)

  const onTrackPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault()
    ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
    setScrubbing(true)
    seekToPct(pctFromEvent(e.clientX))
  }
  const onTrackPointerMove = (e: ReactPointerEvent) => {
    const pct = pctFromEvent(e.clientX)
    setHoverPct(pct)
    if (scrubbing) seekToPct(pct)
  }
  const onTrackPointerUp = (e: ReactPointerEvent) => {
    ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    setScrubbing(false)
  }

  useSpacePlayback(true, () => { hasPlayed ? clock.toggle() : firstPlay() })

  // --- keyboard shortcuts ---
  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.target instanceof HTMLSelectElement) return
    switch (e.key) {
      case 'k':
        e.preventDefault()
        hasPlayed ? clock.toggle() : firstPlay()
        break
      case 'ArrowLeft':
        e.preventDefault()
        clock.seek(Math.max(trimStart, clock.currentSeconds - 5))
        break
      case 'ArrowRight':
        e.preventDefault()
        clock.seek(Math.min(trimEnd, clock.currentSeconds + 5))
        break
      case 'ArrowUp':
        e.preventDefault()
        setMuted(false)
        setVolume((v) => Math.min(1, Math.round((v + 0.1) * 100) / 100))
        break
      case 'ArrowDown':
        e.preventDefault()
        setVolume((v) => Math.max(0, Math.round((v - 0.1) * 100) / 100))
        break
      case 'f':
        e.preventDefault()
        toggleFullscreen()
        break
      case 'm':
        e.preventDefault()
        toggleMute()
        break
    }
    bumpControls()
  }

  // --- loop A/B ---
  const setA = () => {
    clock.setLoopA(clock.currentSeconds)
    if (clock.loopB !== null && clock.currentSeconds < clock.loopB) clock.setLoopEnabled(true)
  }
  const setB = () => {
    clock.setLoopB(clock.currentSeconds)
    if (clock.loopA !== null && clock.currentSeconds > clock.loopA) clock.setLoopEnabled(true)
  }
  const loopAPct = clock.loopA !== null && duration > 0 ? (clock.loopA / duration) * 100 : null
  const loopBPct = clock.loopB !== null && duration > 0 ? (clock.loopB / duration) * 100 : null

  const VolumeIcon = muted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2

  return (
    <div
      ref={containerRef}
      data-lesson-video
      data-fullscreen={isFullscreen}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onPointerMove={bumpControls}
      onMouseLeave={() => {
        if (clock.isPlaying && !speedOpen && !captionsOpen) setControlsVisible(false)
        setHoverPct(null)
      }}
      className={cn(
        'group/player relative isolate aspect-video w-full overflow-hidden rounded-2xl border border-border bg-black shadow-warm outline-none ring-primary/60 focus-visible:ring-2',
        isFullscreen && 'aspect-auto h-full rounded-none border-0',
        className
      )}
    >
      {metronome?.anchorSeconds!=null&&<button type="button" aria-pressed={clickOn} onClick={()=>setClickOn(!clickOn)} className="absolute right-3 top-3 z-20 rounded-lg bg-black/70 px-3 py-2 text-sm text-white">♩ {metronome.bpm} BPM {clickOn?'✓':''}</button>}
      <video controlsList="nodownload noremoteplayback" disablePictureInPicture disableRemotePlayback onContextMenu={event => event.preventDefault()}
        ref={videoRef}
        src={src}
        poster={poster}
        playsInline
        preload="metadata"
        crossOrigin={tracks.length > 0 ? 'anonymous' : undefined}
        onClick={() => (hasPlayed ? clock.toggle() : firstPlay())}
        className="absolute inset-0 h-full w-full bg-black"
      >
        {tracks.map((t) => (
          <track key={t.src} kind="subtitles" src={t.src} srcLang={t.lang} label={t.label} />
        ))}
      </video><VideoWatermark controlsClearance={80} sizeScale={0.85} />

      {/* First-play overlay (also handles the mobile user-gesture requirement) */}
      {!hasPlayed && (
        <button
          type="button"
          onClick={firstPlay}
          className="absolute inset-0 z-20 flex items-center justify-center bg-black/30 transition-colors hover:bg-black/20"
          aria-label={t('dashboard.classViewer.video.playVideo')}
        >
          <span className="grid h-20 w-20 place-items-center rounded-full bg-primary/90 text-white shadow-[0_8px_30px_rgba(0,0,0,0.5)] transition-transform hover:scale-105">
            <Play className="ml-1 h-9 w-9" fill="currentColor" />
          </span>
        </button>
      )}

      {/* Bottom gradient scrim + controls */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-3 pb-2.5 pt-10 transition-opacity duration-300 md:px-4',
          controlsVisible || !hasPlayed ? 'opacity-100' : 'pointer-events-none opacity-0',
          (captionsOpen || speedOpen) && 'z-30'
        )}
      >
        {/* Scrubber */}
        <div
          ref={trackRef}
          onPointerDown={onTrackPointerDown}
          onPointerMove={onTrackPointerMove}
          onPointerUp={onTrackPointerUp}
          onPointerLeave={() => !scrubbing && setHoverPct(null)}
          className="group/track relative mb-2 flex h-4 cursor-pointer items-center"
        >
          {/* track */}
          <div className="relative h-1.5 w-full overflow-visible rounded-full bg-white/20">
            {/* buffered */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-white/25"
              style={{
                width: `${duration > 0 ? (Math.max(0, buffered - trimStart) / duration) * 100 : 0}%`,
              }}
            />
            {/* loop region */}
            {loopAPct !== null && loopBPct !== null && loopBPct > loopAPct && (
              <div
                className="absolute inset-y-0 rounded-full bg-gold/40"
                style={{ left: `${loopAPct}%`, width: `${loopBPct - loopAPct}%` }}
              />
            )}
            {/* played */}
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-primary"
              style={{ width: `${playedPct}%` }}
            />
            {/* hover preview tick */}
            {hoverPct !== null && (
              <div
                className="absolute -top-7 -translate-x-1/2 rounded bg-black/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white"
                style={{ left: `${hoverPct * 100}%` }}
              >
                {fmt(hoverPct * duration)}
              </div>
            )}
            {/* loop markers */}
            {loopAPct !== null && (
              <span className="absolute top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-gold" style={{ left: `${loopAPct}%` }} />
            )}
            {loopBPct !== null && (
              <span className="absolute top-1/2 h-3 w-[2px] -translate-x-1/2 -translate-y-1/2 bg-gold" style={{ left: `${loopBPct}%` }} />
            )}
            {/* thumb */}
            <div
              className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow ring-2 ring-black/40 transition-transform group-hover/track:scale-110"
              style={{ left: `${playedPct}%` }}
            />
          </div>
        </div>

        {/* Control row */}
        <div className="flex items-center gap-2 text-white">
          <ControlButton
            onClick={() => (hasPlayed ? clock.toggle() : firstPlay())}
            label={clock.isPlaying ? t('dashboard.classViewer.video.pause') : t('dashboard.classViewer.video.play')}
          >
            {clock.isPlaying ? <Pause className="h-5 w-5" fill="currentColor" /> : <Play className="h-5 w-5" fill="currentColor" />}
          </ControlButton>

          <ControlButton onClick={toggleFullscreen} label={isFullscreen ? t('dashboard.classViewer.video.exitFullscreen') : t('dashboard.classViewer.video.fullscreen')}>
            {isFullscreen ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
          </ControlButton>

          {/* Volume */}
          <div className="group/vol flex items-center">
            <ControlButton onClick={toggleMute} label={muted ? t('dashboard.classViewer.video.unmute') : t('dashboard.classViewer.video.mute')}>
              <VolumeIcon className="h-5 w-5" />
            </ControlButton>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={muted ? 0 : volume}
              onChange={(e) => {
                const v = Number(e.target.value)
                setVolume(v)
                setMuted(v === 0)
              }}
              aria-label={t('dashboard.classViewer.video.volume')}
              className="h-1 w-0 cursor-pointer appearance-none rounded-full bg-white/30 opacity-0 transition-all duration-200 accent-primary group-hover/vol:ml-1.5 group-hover/vol:w-16 group-hover/vol:opacity-100 focus-visible:ml-1.5 focus-visible:w-16 focus-visible:opacity-100"
            />
          </div>

          <span className="ml-0.5 select-none text-xs font-medium tabular-nums text-white/90">
            {fmt(positionSeconds)} <span className="text-white/50">/ {fmt(duration)}</span>
          </span>

          <div className="flex-1" />

          {/* Loop A/B */}
          <ControlButton onClick={setA} label={t('dashboard.classViewer.video.setLoopStart')}>
            <span className="text-[11px] font-bold">A</span>
          </ControlButton>
          <ControlButton onClick={setB} label={t('dashboard.classViewer.video.setLoopEnd')}>
            <span className="text-[11px] font-bold">B</span>
          </ControlButton>
          <ControlButton
            onClick={() => clock.setLoopEnabled(!clock.loopEnabled)}
            label={t('dashboard.classViewer.video.toggleLoop')}
            active={clock.loopEnabled}
            disabled={clock.loopA === null || clock.loopB === null}
          >
            <Repeat className="h-4 w-4" />
          </ControlButton>
          {(clock.loopA !== null || clock.loopB !== null) && (
            <ControlButton onClick={clock.clearLoop} label={t('dashboard.classViewer.video.clearLoop')}>
              <RotateCcw className="h-4 w-4" />
            </ControlButton>
          )}

          {/* Playback speed */}
          <div className="relative">
            <ControlButton
              onClick={() => setSpeedOpen((o) => !o)}
              label={t('dashboard.classViewer.video.playbackSpeed')}
              active={clock.playbackRate !== 1}
            >
              <span className="flex items-center gap-1">
                <Gauge className="h-4 w-4" />
                <span className="text-[11px] font-bold tabular-nums">{clock.playbackRate}x</span>
              </span>
            </ControlButton>
            {speedOpen && (
              <div
                className="absolute bottom-full right-0 mb-2 min-w-[88px] overflow-hidden rounded-lg border border-border bg-sunken/95 p-1 shadow-warm backdrop-blur-md"
                onMouseLeave={() => setSpeedOpen(false)}
              >
                {SPEEDS.map((sp) => (
                  <button
                    key={sp}
                    type="button"
                    onClick={() => {
                      clock.setPlaybackRate(sp)
                      setSpeedOpen(false)
                    }}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted',
                      clock.playbackRate === sp ? 'text-primary' : 'text-foreground'
                    )}
                  >
                    {sp}x{clock.playbackRate === sp && <span className="text-primary">•</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Subtitle and audio language settings share one menu. */}
          {dubbedAudio.error && <span role="status" className="text-xs text-white">{locale === 'es' ? 'Audio no disponible. Se restauró el original.' : 'Audio unavailable. Original restored.'}</span>}
          {(tracks.length > 0 || audioTracks.length > 0) && (
            <div className="relative">
              <ControlButton
                onClick={() => setCaptionsOpen((o) => !o)}
                label={locale === 'es' ? 'Subtítulos y audio' : 'Subtitles and audio'}
                active={activeLang !== 'off' || dubbedAudio.language !== 'original'}
              >
                <Captions className="h-5 w-5" />
              </ControlButton>
              {captionsOpen && (
                <div
                  className="absolute bottom-full right-0 mb-2 max-h-[min(60vh,320px)] w-48 overflow-y-auto rounded-xl border border-white/20 bg-[#171412] p-2 text-white shadow-xl"
                  onMouseLeave={() => setCaptionsOpen(false)}
                >
                  <section aria-label={locale === 'es' ? 'Subtítulos' : 'Subtitles'}>
                    <h3 className="px-2.5 pb-2 pt-1 text-base font-bold text-white">{locale === 'es' ? 'Subtítulos' : 'Subtitles'}</h3>
                    {[
                      { value: 'off' as const, label: t('dashboard.classViewer.video.subtitlesOff') },
                      ...tracks.map((track) => ({ value: track.lang, label: track.label })),
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={activeLang === opt.value}
                        onClick={() => setActiveLang(opt.value)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          activeLang === opt.value ? 'font-semibold text-primary' : 'text-white/90'
                        )}
                      >
                        {opt.label}
                        {activeLang === opt.value && <span aria-hidden="true">✓</span>}
                      </button>
                    ))}
                  </section>
                  <hr className="my-2 border-white/20" />
                  <section aria-label="Audio">
                    <h3 className="px-2.5 pb-2 pt-1 text-base font-bold text-white">Audio</h3>
                    {[
                      { value: 'original', label: locale === 'es' ? 'Español (original)' : 'Spanish (original)' },
                      ...audioTracks.map((track) => ({ value: track.lang, label: track.label })),
                    ].map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={dubbedAudio.language === opt.value}
                        onClick={() => dubbedAudio.setLanguage(opt.value)}
                        className={cn(
                          'flex w-full items-center justify-between rounded-md px-2.5 py-2 text-left text-sm transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                          dubbedAudio.language === opt.value ? 'font-semibold text-primary' : 'text-white/90'
                        )}
                      >
                        {opt.label}
                        {dubbedAudio.language === opt.value && <span aria-hidden="true">✓</span>}
                      </button>
                    ))}
                  </section>
                </div>
              )}
            </div>
          )}


        </div>
      </div>
    </div>
  )
}

function ControlButton({
  onClick,
  label,
  active,
  disabled,
  children,
}: {
  onClick: () => void
  label: string
  active?: boolean
  disabled?: boolean
  children: ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        'grid h-8 min-w-8 place-items-center rounded-md px-1.5 text-white/90 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 disabled:cursor-not-allowed disabled:opacity-40',
        active && 'text-primary hover:text-primary'
      )}
    >
      {children}
    </button>
  )
}
