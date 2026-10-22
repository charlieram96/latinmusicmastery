'use client';
import './classroom-transport.css';
import { useLessonFrame } from '@/components/class-viewer/lesson-viewer/lesson-mode/lesson-frame';

import { useTranslation } from '@/components/language-provider';
import { studioText } from '@/lib/playsense-studio/i18n/text';

// PlaySense Studio transport bar — play/pause, scrub, time, speed, A/B loop.
//
// Loop UI: a tiny "set A" / "set B" / clear-loop / loop-toggle cluster sits
// next to the rate selector. The scrub bar shows the loop range as a tinted
// span, with vertical markers at A and B. When loop is enabled but the user
// scrubs outside the range, the wrap kicks in on the next RAF tick.

import { AudioLines, Pause, Play, Repeat, RotateCcw, Volume2, VolumeX, X } from 'lucide-react';
import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { ChronometerControl } from './chronometer-control';
import type { ActiveSubtitleLang } from '../state/use-subtitle-tracks';
import type { SubtitleTrackDef } from '@/lib/subtitles/srt-to-vtt';

// Accent for scored-notation regions on the seek bar — a saturated green that
// stays distinct from the warm amber played-fill and reads clearly in both
// light and dark themes (the transport sits on the page-themed card surface).
const NOTATION_HUE = '150 58% 42%';

interface TransportBarProps {
  currentSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  playbackRate: number;
  onToggle: () => void;
  onRestart: () => void;
  onSeek: (seconds: number) => void;
  onRateChange: (rate: number) => void;

  /** 'stacked' (default) is the two-row student player. 'row' is the Studio's
   *  single-row transport (mockup .st-transport), with the scrubber inline. */
  layout?: 'stacked' | 'row';
  /** Extra controls rendered in the row layout, just before the volume block. */
  extra?: ReactNode;
  metronomeControls?: ReactNode;
  trailingControls?: ReactNode;
  fullscreenControl?: ReactNode;

  // A/B loop — endpoints are set by dragging on the staff. The transport
  // exposes the toggle + clear so the user can disarm/clear without
  // touching the staff.
  onSetLoopA?: (seconds: number) => void;
  onSetLoopB?: (seconds: number) => void;
  loopA: number | null;
  loopB: number | null;
  loopEnabled: boolean;
  /** A practice clip must keep its authored bounds. */
  loopLocked?: boolean;
  onToggleLoop: () => void;
  onClearLoop: () => void;
  /** The loop button's hint while no range is set; the Studio adds its L key. */
  loopHint?: string;

  // Click-track context
  bpm: number;
  beatsPerMeasure: number;
  /** Click state, owned by whoever runs the click engine. */
  clickOn?: boolean;
  onClickOnChange?: (on: boolean) => void;
  /** False when the section under the playhead has no metronome anchor, so the
   *  click cannot be aligned to the recording. */
  clickAligned?: boolean;
  clickVolume?: number;
  onClickVolumeChange?: (volume: number) => void;

  /** The reference video's own audio. Omit to hide the control entirely, which
   *  is what every surface except the studio sync stage does. */
  videoMuted?: boolean;
  onVideoMutedChange?: (muted: boolean) => void;
  videoVolume?: number;
  onVideoVolumeChange?: (volume: number) => void;

  // Scored-section regions drawn on the scrub bar (clickable to jump). Used by
  // multi-section video lessons; omitted elsewhere.
  sectionMarkers?: Array<{ startSeconds: number; endSeconds: number | null; label?: string | null }>;

  // Subtitles — present only when the lesson has caption tracks. The CC button
  // opens a small Off/English/Español picker.
  subtitleOptions?: SubtitleTrackDef[];
  activeSubtitleLang?: ActiveSubtitleLang;
  onSubtitleLangChange?: (lang: ActiveSubtitleLang) => void;
}

export function TransportBar({
  fullscreenControl,
  currentSeconds,
  durationSeconds,
  isPlaying,
  playbackRate,
  onToggle,
  onRestart,
  onSeek,
  onRateChange,
  layout = 'stacked',
  extra,
  metronomeControls,
  trailingControls,
  onSetLoopA,
  onSetLoopB,
  loopA,
  loopB,
  loopEnabled,
  onToggleLoop,
  onClearLoop,
  loopLocked = false,
  loopHint = 'Drag on the staff to set a loop range',
  bpm,
  beatsPerMeasure,
  clickOn = false,
  onClickOnChange,
  clickAligned = true,
  clickVolume = 0.2,
  onClickVolumeChange,
  videoMuted = false,
  onVideoMutedChange,
  videoVolume = 1,
  onVideoVolumeChange,
  sectionMarkers,
  subtitleOptions,
  activeSubtitleLang = 'off',
  onSubtitleLangChange,
}: TransportBarProps) {
  const lessonFrame = useLessonFrame();
  const { locale } = useTranslation();
  const st = (text: string) => studioText(text, locale);
  const [captionsOpen, setCaptionsOpen] = useState(false);
  const safeDuration = Math.max(durationSeconds, 0.001);
  const loopAPct = loopA !== null ? (loopA / safeDuration) * 100 : null;
  const loopBPct = loopB !== null ? (loopB / safeDuration) * 100 : null;
  const playedPct = (currentSeconds / safeDuration) * 100;

  // --- pointer-driven scrubbing (replaces the native range input) ---
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [scrubbing, setScrubbing] = useState(false);
  const [hoverPct, setHoverPct] = useState<number | null>(null);

  const pctFromEvent = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return 0;
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  };
  const onTrackPointerDown = (e: ReactPointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    setScrubbing(true);
    onSeek(pctFromEvent(e.clientX) * safeDuration);
  };
  const onTrackPointerMove = (e: ReactPointerEvent) => {
    const pct = pctFromEvent(e.clientX);
    setHoverPct(pct);
    if (scrubbing) onSeek(pct * safeDuration);
  };
  const onTrackPointerUp = (e: ReactPointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture?.(e.pointerId);
    setScrubbing(false);
  };

  const scrubber = (
      <div
        ref={trackRef}
        role="slider" tabIndex={0} aria-label={locale === 'es' ? 'Posición del video' : 'Video position'}
        aria-valuemin={0} aria-valuemax={durationSeconds} aria-valuenow={currentSeconds}
        onKeyDown={event => {
          const target = event.key === 'Home' ? 0 : event.key === 'End' ? durationSeconds : event.key === 'ArrowRight' ? currentSeconds + 1 : event.key === 'ArrowLeft' ? currentSeconds - 1 : null;
          if (target !== null) { event.preventDefault(); event.stopPropagation(); onSeek(Math.max(0, Math.min(durationSeconds, target))); }
        }}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        onPointerLeave={() => !scrubbing && setHoverPct(null)}
        className="group/track relative flex h-[18px] cursor-pointer touch-none items-center"
      >
        <div className="relative h-[4px] w-full overflow-visible rounded-full bg-foreground/30">
          {/* Loop range tint */}
          {loopAPct !== null && loopBPct !== null && loopBPct > loopAPct && (
            <div
              aria-hidden
              className="absolute inset-y-0 rounded-full pointer-events-none"
              style={{
                left: `${loopAPct}%`,
                width: `${loopBPct - loopAPct}%`,
                background: loopEnabled
                  ? 'hsl(var(--primary) / 0.35)'
                  : 'hsl(var(--primary) / 0.16)',
              }}
            />
          )}

          {/* Played */}
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-primary"
            style={{ width: `${playedPct}%` }}
          />

          {/* Scored-notation regions — drawn above the played fill so they stay
              legible whether or not playback has passed them. */}
          {sectionMarkers?.map((m, i) => {
            const startPct = (m.startSeconds / safeDuration) * 100;
            const endPct = ((m.endSeconds ?? m.startSeconds) / safeDuration) * 100;
            return (
              <div
                key={`sec-tint-${i}`}
                aria-hidden
                className="absolute inset-y-0 rounded-[4px] pointer-events-none"
                style={{
                  left: `${startPct}%`,
                  width: `${Math.max(0.6, endPct - startPct)}%`,
                  background: `hsl(${NOTATION_HUE} / 0.85)`,
                  boxShadow: `inset 0 0 0 1px hsl(${NOTATION_HUE})`,
                }}
              />
            );
          })}

          {/* Hover preview tick */}
          {hoverPct !== null && (
            <div
              className="absolute -top-7 -translate-x-1/2 rounded bg-black/90 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-white pointer-events-none"
              style={{ left: `${hoverPct * 100}%` }}
            >
              {formatSeconds(hoverPct * safeDuration)}
            </div>
          )}

          {/* A / B markers */}
          {loopAPct !== null && <LoopMarker label="A" pct={loopAPct} />}
          {loopBPct !== null && <LoopMarker label="B" pct={loopBPct} />}

          {/* Playhead — vertical line */}
          <div
            className="absolute top-1/2 z-30 h-[10px] w-[2px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow ring-1 ring-black/40 transition-transform group-hover/track:scale-y-110"
            style={{ left: `${playedPct}%` }}
          />
        </div>
      </div>
  );

  const lead = (
    <>
      <button
        onClick={onToggle}
        className="st-play-btn"
        aria-label={st(isPlaying ? 'Pause' : 'Play')}
      >
        {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
      </button>

      <button onClick={onRestart} className="st-iconbtn" aria-label={st('Restart')}>
        <RotateCcw className="h-4 w-4" />
      </button>

      <span className="st-tp-time">
        {formatSeconds(currentSeconds)}
        <span className="sep">/</span>
        {formatSeconds(durationSeconds)}
      </span>
    </>
  );

  const rest = (
    <>
        {/* Video and staff edit the same loop endpoints. */}
        <div className="flex items-center gap-1 sm:ml-2">
          {onSetLoopA && <button type="button" className="st-iconbtn" aria-label={locale === 'es' ? 'Marcar inicio del loop (A)' : 'Set loop start (A)'} title={locale === 'es' ? 'Marcar inicio del loop (A)' : 'Set loop start (A)'} onClick={() => onSetLoopA(currentSeconds)} aria-pressed={loopA !== null}>A</button>}
          {onSetLoopB && <button type="button" className="st-iconbtn" aria-label={locale === 'es' ? 'Marcar fin del loop (B)' : 'Set loop end (B)'} title={locale === 'es' ? 'Marcar fin del loop (B)' : 'Set loop end (B)'} disabled={loopA === null || currentSeconds <= loopA + .01} onClick={() => onSetLoopB(currentSeconds)} aria-pressed={loopB !== null}>B</button>}
          <button
            onClick={onToggleLoop}
            disabled={loopLocked || loopA === null || loopB === null}
            className="st-iconbtn"
            style={
              loopEnabled
                ? {
                    color: 'hsl(var(--primary))',
                    background: 'color-mix(in srgb, hsl(var(--primary)) 12%, transparent)',
                  }
                : undefined
            }
            title={
              loopA === null || loopB === null
                ? (onSetLoopA ? (locale === 'es' ? 'Marca A y B para repetir un fragmento' : 'Mark A and B to loop a segment') : st(loopHint))
                : loopEnabled
                  ? st('Loop on')
                  : st('Loop off')
            }
            aria-pressed={loopEnabled}
          >
            <Repeat className="h-4 w-4" />
          </button>
          {!loopLocked && (loopA !== null || loopB !== null) && (
            <button onClick={onClearLoop} className="st-iconbtn" title={st('Clear loop')} aria-label={st('Clear loop')}>
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Subtitles */}
        {subtitleOptions && subtitleOptions.length > 0 && onSubtitleLangChange && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setCaptionsOpen((o) => !o)}
              className="st-iconbtn"
              style={
                activeSubtitleLang !== 'off'
                  ? {
                      color: 'hsl(var(--primary))',
                      background: 'color-mix(in srgb, hsl(var(--primary)) 12%, transparent)',
                    }
                  : undefined
              }
              title={st('Subtitles')}
              aria-label={st('Subtitles')}
              aria-expanded={captionsOpen}
              aria-pressed={activeSubtitleLang !== 'off'}
            >
              <span aria-hidden="true" className="inline-flex h-5 w-7 items-center justify-center rounded border border-primary/50 bg-primary/15 text-[11px] font-extrabold tracking-tight text-primary">CC</span>
            </button>
            {captionsOpen && (
              <div
                className="absolute bottom-full right-0 z-40 mb-2 max-h-64 min-w-[110px] overflow-y-auto rounded-lg border border-border bg-popover/95 p-1 shadow-lg backdrop-blur"
                onMouseLeave={() => setCaptionsOpen(false)}
              >
                {[
                  { value: 'off' as ActiveSubtitleLang, label: st('Off') },
                  ...subtitleOptions.map((t) => ({
                    value: t.lang as ActiveSubtitleLang,
                    label: t.label,
                  })),
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onSubtitleLangChange(opt.value);
                      setCaptionsOpen(false);
                    }}
                    className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors hover:bg-muted ${
                      activeSubtitleLang === opt.value ? 'text-primary' : 'text-foreground'
                    }`}
                  >
                    {opt.label}
                    {activeSubtitleLang === opt.value && <span className="text-primary">•</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {extra}
        {onClickOnChange && <button type="button" data-score-preserve-selection
          className={`inline-flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs ${clickOn?'border-primary bg-primary/15 text-primary':'border-border text-muted-foreground'}`}
          aria-label={st(clickOn?'Turn metronome off':'Turn metronome on')} aria-pressed={clickOn}
          title={st(clickOn?'Turn metronome off':'Turn metronome on')}
          onClick={()=>onClickOnChange(!clickOn)}><AudioLines className="h-4 w-4"/><span>{st(clickOn?'On':'Off')}</span></button>}
        <ChronometerControl
          extra={metronomeControls}
          baseBpm={bpm}
          beatsPerMeasure={beatsPerMeasure}
          playbackRate={playbackRate}
          isPlaying={isPlaying}
          onRateChange={onRateChange}
          clickOn={clickOn}
          onClickOnChange={onClickOnChange ?? (() => {})}
          clickAligned={clickAligned}
          clickVolume={clickVolume}
          onClickVolumeChange={onClickVolumeChange ?? (() => {})}
        />
        {layout !== 'row' && lessonFrame?.registerTransport && !lessonFrame.noClaim && <div className="shrink-0" data-transport-actions ref={lessonFrame.registerTransport} />}
        {layout === 'row' && onClickVolumeChange && <input type="range" min="0" max="1" step="0.05" value={clickVolume} onChange={e=>onClickVolumeChange(Number(e.target.value))} aria-label={st('Metronome volume')} className="w-16 shrink-0 accent-primary" />}

        {/* Reference-video audio. Only rendered where something owns it. */}
        {onVideoMutedChange && (
          <div className="ml-auto flex items-center gap-1.5">
            {fullscreenControl}
            <button
              type="button"
              onClick={() => onVideoMutedChange(!videoMuted)}
              className={`st-iconbtn${videoMuted ? '' : ' is-on'}`}
              aria-pressed={!videoMuted}
              title={videoMuted ? 'Unmute the reference video' : 'Mute the reference video'}
            >
              {videoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={videoMuted ? 0 : videoVolume}
              onChange={(e) => onVideoVolumeChange?.(Number(e.target.value))}
              className="h-1 w-20 cursor-pointer accent-primary"
              aria-label={st('Reference video volume')}
              title={`Reference video — ${Math.round((videoMuted ? 0 : videoVolume) * 100)}%`}
            />
          </div>
        )}

        {trailingControls && <div className="ml-auto shrink-0">{trailingControls}</div>}

    </>
  );

  if (layout === 'row') {
    return (
      <div className="st-transport-row lmm-media-transport">
        {lead}
        <div className="st-transport-scrub">{scrubber}</div>
        {rest}
      </div>
    );
  }

  return (
    <div className="lmm-media-transport space-y-0">
      {scrubber}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        {lead}
        {rest}
      </div>
    </div>
  );
}

function LoopMarker({ label, pct }: { label: string; pct: number }) {
  return (
    <div
      aria-hidden
      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 pointer-events-none"
      style={{ left: `${pct}%` }}
    >
      <div className="w-0.5 h-5 bg-primary" />
      <div className="text-[10px] font-bold text-primary mt-0.5 -translate-x-1/2 ml-0.5">
        {label}
      </div>
    </div>
  );
}

function formatSeconds(s: number): string {
  if (!Number.isFinite(s) || s < 0) s = 0;
  const total = Math.floor(s);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
