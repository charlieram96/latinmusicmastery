'use client';

// PlaySense Studio transport bar — play/pause, scrub, time, speed, A/B loop.
//
// Loop UI: a tiny "set A" / "set B" / clear-loop / loop-toggle cluster sits
// next to the rate selector. The scrub bar shows the loop range as a tinted
// span, with vertical markers at A and B. When loop is enabled but the user
// scrubs outside the range, the wrap kicks in on the next RAF tick.

import { Captions, Pause, Play, Repeat, RotateCcw, X } from 'lucide-react';
import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { ChronometerControl } from './chronometer-control';
import type { ActiveSubtitleLang } from '../state/use-subtitle-tracks';
import type { SubtitleTrackDef } from '@/lib/subtitles/srt-to-vtt';

// Accent for scored-notation regions on the seek bar — a saturated green that
// stays distinct from the warm amber played-fill and reads clearly in both
// light and dark themes (the transport sits on the page-themed card surface).
const NOTATION_HUE = '150 58% 42%';
const NOTATION_HUE_TEXT = '0 0% 100%';

interface TransportBarProps {
  currentSeconds: number;
  durationSeconds: number;
  isPlaying: boolean;
  playbackRate: number;
  onToggle: () => void;
  onRestart: () => void;
  onSeek: (seconds: number) => void;
  onRateChange: (rate: number) => void;

  // A/B loop — endpoints are set by dragging on the staff. The transport
  // exposes the toggle + clear so the user can disarm/clear without
  // touching the staff.
  loopA: number | null;
  loopB: number | null;
  loopEnabled: boolean;
  onToggleLoop: () => void;
  onClearLoop: () => void;

  // Click-track context
  bpm: number;
  beatsPerMeasure: number;

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
  currentSeconds,
  durationSeconds,
  isPlaying,
  playbackRate,
  onToggle,
  onRestart,
  onSeek,
  onRateChange,
  loopA,
  loopB,
  loopEnabled,
  onToggleLoop,
  onClearLoop,
  bpm,
  beatsPerMeasure,
  sectionMarkers,
  subtitleOptions,
  activeSubtitleLang = 'off',
  onSubtitleLangChange,
}: TransportBarProps) {
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

  return (
    <div className="space-y-2">
      {/* Scrubber */}
      <div
        ref={trackRef}
        onPointerDown={onTrackPointerDown}
        onPointerMove={onTrackPointerMove}
        onPointerUp={onTrackPointerUp}
        onPointerLeave={() => !scrubbing && setHoverPct(null)}
        className="group/track relative flex h-[34px] cursor-pointer touch-none items-start"
      >
        <div className="relative mt-1 h-[11px] w-full overflow-visible rounded-full bg-foreground/30">
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

          {/* Notation tags — sit underneath the bar, left-aligned to the start
              of each scored section, and jump there on click. */}
          {sectionMarkers?.map((m, i) => {
            const startPct = (m.startSeconds / safeDuration) * 100;
            const label = m.label || 'Notation';
            return (
              <button
                key={`sec-tag-${i}`}
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => onSeek(m.startSeconds)}
                title={`Jump to ${label}`}
                aria-label={`Jump to ${label}`}
                className="absolute top-full z-20 mt-1 block max-w-[100px] truncate whitespace-nowrap rounded px-1 py-px text-[7px] font-bold uppercase leading-none tracking-[0.04em] transition-opacity hover:opacity-80"
                style={{
                  left: `${startPct}%`,
                  background: `hsl(${NOTATION_HUE})`,
                  color: `hsl(${NOTATION_HUE_TEXT})`,
                }}
              >
                {label}
              </button>
            );
          })}

          {/* A / B markers */}
          {loopAPct !== null && <LoopMarker label="A" pct={loopAPct} />}
          {loopBPct !== null && <LoopMarker label="B" pct={loopBPct} />}

          {/* Playhead — vertical line */}
          <div
            className="absolute top-1/2 z-30 h-[18px] w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow ring-1 ring-black/40 transition-transform group-hover/track:scale-y-110"
            style={{ left: `${playedPct}%` }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
        <button
          onClick={onToggle}
          className="st-play-btn"
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
        </button>

        <button onClick={onRestart} className="st-iconbtn" aria-label="Restart">
          <RotateCcw className="h-4 w-4" />
        </button>

        <span className="st-tp-time">
          {formatSeconds(currentSeconds)}
          <span className="sep">/</span>
          {formatSeconds(durationSeconds)}
        </span>

        {/* Loop control cluster — endpoints are set by dragging on the staff;
            this row only toggles + clears + offers the metronome. */}
        <div className="flex items-center gap-1 sm:ml-2">
          <button
            onClick={onToggleLoop}
            disabled={loopA === null || loopB === null}
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
                ? 'Drag on the staff to set a loop range'
                : loopEnabled
                  ? 'Loop on'
                  : 'Loop off'
            }
            aria-pressed={loopEnabled}
          >
            <Repeat className="h-4 w-4" />
          </button>
          {(loopA !== null || loopB !== null) && (
            <button onClick={onClearLoop} className="st-iconbtn" title="Clear loop" aria-label="Clear loop">
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
              title="Subtitles"
              aria-label="Subtitles"
              aria-pressed={activeSubtitleLang !== 'off'}
            >
              <Captions className="h-4 w-4" />
            </button>
            {captionsOpen && (
              <div
                className="absolute bottom-full right-0 z-40 mb-2 max-h-64 min-w-[110px] overflow-y-auto rounded-lg border border-border bg-popover/95 p-1 shadow-lg backdrop-blur"
                onMouseLeave={() => setCaptionsOpen(false)}
              >
                {[
                  { value: 'off' as ActiveSubtitleLang, label: 'Off' },
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

        <span className="st-divline ml-auto hidden sm:block" />
        <ChronometerControl
          baseBpm={bpm}
          beatsPerMeasure={beatsPerMeasure}
          playbackRate={playbackRate}
          isPlaying={isPlaying}
          onRateChange={onRateChange}
        />
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
