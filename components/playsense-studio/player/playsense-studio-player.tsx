'use client';

// PlaySense Studio top-level player.
//
// Wires:
//   <video> ──> useVideoTransportClock ──> currentSeconds
//                                              │
//                                              v
//   TimeMap.toMusicalPosition(seconds) ──> QN ──> score-internal ms
//                                                      │
//                                                      v
//                                             StaffRenderer.currentMs
//                                                      │
//                                                      v
//                                          (click-to-seek emits QN back)
//                                                      │
//                                                      v
//                                          TimeMap.toVideoTime(QN)
//                                                      │
//                                                      v
//                                          video.currentTime = seconds
//
// When no TimeMap is attached to the class item, synthesize a default map
// from the score's tempo (2 waypoints: start and end). This makes the player
// usable as soon as a score document is attached, with sync polish coming
// from M7's authoring tools.

import { useTranslation } from '@/components/language-provider';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Rows3, MoveHorizontal, Minus, Plus } from 'lucide-react';
import { SplitWorkspace, OrientationToggle } from './split-workspace';
import { DownloadMenu } from '@/components/playsense-studio/export/download-menu';
import { TransportBar } from './transport/transport-bar';
import { VideoStage } from './video/video-stage';
import {
  StaffRenderer,
  ZOOM_MIN,
  ZOOM_MAX,
  type SelectedRange,
} from './notation/renderers/staff-renderer';
import { StaffScrubBar } from './notation/staff-scrub-bar';
import { ClipsPanel } from './clips/clips-panel';
import { useVideoTransportClock } from './state/use-video-transport-clock';
import { useSubtitleTracks } from './state/use-subtitle-tracks';
import type { SubtitleLang, SubtitleTrackDef } from '@/lib/subtitles/srt-to-vtt';
import { logPlaysenseStudioEvent, type PlaysenseStudioClip } from '@/app/actions/playsense-studio';
import {
  WaypointTimeMap,
  type SyncMethod,
  type Waypoint,
} from '@/components/playsense-studio/shared/time-map/time-map';
import { qnToTrackMs, trackDurationQN } from '@/lib/playsense-studio/time-mapping';
import { pickActiveSection } from '@/lib/playsense-studio/active-section';
import { lessonSectionGaps } from '@/lib/playsense-studio/lesson-notation';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import type { SeekTarget } from '@/lib/playsense-studio/renderer';
import { updateClassItemPosition } from '@/app/actions/progress';

export interface PlaysenseStudioPlayerScoreTrack {
  id: string;
  trackIndex: number;
  instrument: string;
  displayName: string;
  tuning: string[] | null;
  stringMultiplicity: number;
  defaultView: string | null;
}

export interface PlaysenseStudioPlayerTimeMap {
  id: string;
  method: string;
  waypoints: Array<{
    musicalPositionQN: number;
    videoTimeSeconds: number;
    measureNumber: number | null;
    beatInMeasure: number | null;
  }>;
}

/** One scored section of a video: a score + sync valid over a video time-range. */
export interface PlayerSection {
  id: string;
  label?: string | null;
  /** null = no fixed start (the synthetic single-section case → always active). */
  videoStartSeconds: number | null;
  videoEndSeconds: number | null;
  score: ScoreDocument;
  tracks: PlaysenseStudioPlayerScoreTrack[];
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
}

export interface PlaysenseStudioPlayerProps {
  classItemId: string;
  /** Class item title used to name exported sheet-music files; falls back to the score title. */
  classItemTitle?: string;
  videoUrl: string;
  posterUrl?: string;
  score: ScoreDocument;
  tracks: PlaysenseStudioPlayerScoreTrack[];
  activeTimeMap: PlaysenseStudioPlayerTimeMap | null;
  /**
   * Multiple scored sections, each active over a video time-range. When provided,
   * the player swaps the displayed score by the current video time and shows a
   * placeholder during gaps. Omit for the single-score case (uses score/tracks/
   * activeTimeMap above). Pass only PLACED sections (non-null start + a time map).
   */
  sections?: PlayerSection[];
  /** When true, cursor + render proceed but the position-tracking server action is skipped. */
  readOnly?: boolean;
  /**
   * 'stack' (default) — video, transport, then staff in a single column.
   * 'split' — video pane next to the PlaySense notation pane, resizable with a
   * diagonal corner knob and a side-by-side ↔ stacked orientation toggle.
   */
  layout?: 'stack' | 'split';
  /** Fired when the demo video plays to its end. */
  onEnded?: () => void;
  /** WebVTT subtitle tracks for the demo video (rendered by VideoStage). */
  subtitles?: SubtitleTrackDef[];
  /** UI locale — the matching track starts showing; user can switch/turn off. */
  defaultSubtitleLang?: SubtitleLang;
}

const POSITION_SAVE_INTERVAL_MS = 5000;

export function PlaysenseStudioPlayer({
  classItemId,
  classItemTitle,
  videoUrl,
  posterUrl,
  score: singleScore,
  tracks: singleTracks,
  activeTimeMap: singleTimeMap,
  sections,
  readOnly,
  layout = 'stack',
  onEnded,
  subtitles,
  defaultSubtitleLang,
}: PlaysenseStudioPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const clock = useVideoTransportClock(videoRef, { onEnded });
  const subtitleTracks = subtitles ?? [];
  const { activeLang: activeSubtitleLang, setActiveLang: setActiveSubtitleLang } =
    useSubtitleTracks(videoRef, subtitleTracks, defaultSubtitleLang);

  // Normalize to a list of sections. With none provided, the single score becomes
  // one always-active section (start = null) so the rest of the player is unchanged.
  const normalizedSections = useMemo<PlayerSection[]>(() => {
    if (sections && sections.length > 0) return sections;
    return [
      {
        id: '__single__',
        label: null,
        videoStartSeconds: null,
        videoEndSeconds: null,
        score: singleScore,
        tracks: singleTracks,
        activeTimeMap: singleTimeMap,
      },
    ];
  }, [sections, singleScore, singleTracks, singleTimeMap]);

  // Which section is active at the current video time (-1 = none → gap).
  const activeSectionIndex = pickActiveSection(normalizedSections, clock.currentSeconds);
  const activeSection = activeSectionIndex >= 0 ? normalizedSections[activeSectionIndex] : null;
  const hasNotation = activeSection !== null;

  // Placed sections in time order — used to resolve the current gap.
  const placedSections = useMemo(
    () =>
      normalizedSections
        .filter((s) => s.videoStartSeconds != null)
        .sort(
          (a, b) => (a.videoStartSeconds as number) - (b.videoStartSeconds as number)
        ),
    [normalizedSections]
  );

  // The section whose trailing gap we're sitting in (the one that just ended).
  const prevSection = useMemo(() => {
    let p: PlayerSection | null = null;
    for (const s of placedSections) {
      const end = s.videoEndSeconds ?? s.videoStartSeconds;
      if (end != null && (end as number) <= clock.currentSeconds) p = s;
    }
    return p;
  }, [placedSections, clock.currentSeconds]);

  const upcomingSection = useMemo(
    () =>
      placedSections.find(
        (s) => (s.videoStartSeconds as number) > clock.currentSeconds + 0.05
      ) ?? null,
    [placedSections, clock.currentSeconds]
  );

  // The staff is never blank: during a gap we keep showing the section we just
  // finished alongside its video interlude; before the first
  // section we preview the upcoming one.
  const displaySection =
    activeSection ?? prevSection ?? upcomingSection ?? normalizedSections[0];
  const inTrailingGap = !activeSection && prevSection !== null && displaySection === prevSection;

  // Effective score/tracks/time-map drive all the existing logic below — now
  // always sourced from the displayed section so the staff is never blank.
  const score = displaySection.score;
  const tracks = displaySection.tracks;
  const activeTimeMap = displaySection.activeTimeMap;

  const [activeTrackIndex, setActiveTrackIndex] = useState(0);
  const activeTrack = score.tracks[activeTrackIndex] ?? score.tracks[0];
  const activeSectionId = displaySection.id;

  // Track view-switch events. We only count it as a switch after the
  // first render so the initial mount doesn't create a spurious event.
  const previousTrackRef = useRef(activeTrackIndex);
  useEffect(() => {
    if (readOnly) return;
    if (previousTrackRef.current !== activeTrackIndex) {
      previousTrackRef.current = activeTrackIndex;
      void logPlaysenseStudioEvent({
        eventType: 'playsense_studio_view_switched',
        classItemId,
        metadata: {
          to_track_index: activeTrackIndex,
          to_instrument: score.tracks[activeTrackIndex]?.instrument,
        },
      });
    }
  }, [activeTrackIndex, classItemId, readOnly, score]);

  // Build (or synthesize) the WaypointTimeMap for the active track.
  const timeMap = useMemo(() => {
    return buildTimeMap(score, activeTrackIndex, activeTimeMap, clock.durationSeconds);
  }, [score, activeTrackIndex, activeTimeMap, clock.durationSeconds]);

  // Total score-internal ms of the displayed section's notation — the point the
  // trailing video interlude begins.
  const sectionTotalMs = useMemo(() => {
    const tr = score.tracks[activeTrackIndex] ?? score.tracks[0];
    if (!tr) return 0;
    return qnToTrackMs(tr, score, trackDurationQN(tr, score));
  }, [score, activeTrackIndex]);

  const interludes = useMemo(() => lessonSectionGaps(displaySection, normalizedSections, clock.durationSeconds),
    [displaySection, normalizedSections, clock.durationSeconds]);
  const leadingGapMs = interludes.leading ? (interludes.leading.endSeconds - interludes.leading.startSeconds) * 1000 : 0;
  const trailingGapMs = interludes.trailing ? (interludes.trailing.endSeconds - interludes.trailing.startSeconds) * 1000 : 0;
  const inLeadingGap = !!interludes.leading && clock.currentSeconds < interludes.leading.endSeconds;

  // Convert video seconds → score-internal ms. Video interludes advance at
  // video rate, independently of the score's tempo and synchronization map.
  const cursorMs = useMemo(() => {
    if (inLeadingGap && interludes.leading) return (clock.currentSeconds - interludes.leading.endSeconds) * 1000;
    if (!timeMap) return 0;
    if (inTrailingGap && displaySection.videoEndSeconds != null) {
      const gapElapsedMs = Math.max(
        0,
        (clock.currentSeconds - (displaySection.videoEndSeconds as number)) * 1000
      );
      return sectionTotalMs + gapElapsedMs;
    }
    const qn = timeMap.toMusicalPosition(clock.currentSeconds);
    return qnToTrackMs(activeTrack, score, qn);
  }, [
    clock.currentSeconds,
    timeMap,
    activeTrack,
    score,
    inTrailingGap,
    inLeadingGap,
    interludes.leading,
    displaySection,
    sectionTotalMs,
  ]);

  // Loop markers in the staff are placed at the score-internal ms
  // corresponding to the (video-time) loop endpoints — same translation
  // path the playhead takes.
  const loopAMs = useMemo(() => {
    if (!timeMap || clock.loopA === null) return null;
    const qn = timeMap.toMusicalPosition(clock.loopA);
    return qnToTrackMs(activeTrack, score, qn);
  }, [timeMap, clock.loopA, activeTrack, score]);
  const loopBMs = useMemo(() => {
    if (!timeMap || clock.loopB === null) return null;
    const qn = timeMap.toMusicalPosition(clock.loopB);
    return qnToTrackMs(activeTrack, score, qn);
  }, [timeMap, clock.loopB, activeTrack, score]);

  // Independent staff view position. When isFollowing is true, the view
  // tracks playback (cursorMs); when false, viewMs is held wherever the
  // user dragged the scroll bar last.
  const [browsedMs, setViewMs] = useState(0);
  const [isFollowing, setIsFollowing] = useState(true);
  const [trackDurationMs, setTrackDurationMs] = useState(0);
  // Derive following directly so a track reset cannot hide the negative-time intro.
  const viewMs = isFollowing ? cursorMs : browsedMs;

  // Reset view + follow flag when the active track changes — different
  // tracks have different durations, and a scrub position from one doesn't
  // make sense for another.
  useEffect(() => {
    setIsFollowing(true);
    setViewMs(0);
  }, [activeTrackIndex]);

  // When the active section changes (a different score swaps in), reset the
  // track selection and staff view so nothing carries over from the last section.
  const prevSectionIdRef = useRef(activeSectionId);
  useEffect(() => {
    if (prevSectionIdRef.current === activeSectionId) return;
    prevSectionIdRef.current = activeSectionId;
    setActiveTrackIndex(0);
    setIsFollowing(true);
    setViewMs(0);
  }, [activeSectionId]);

  // Click-on-staff → seek the video. Importantly we do NOT re-engage
  // follow here: the user wants the orange line to land at the click
  // position, not the staff to jump so the click position becomes the
  // anchor. If they want follow back, they hit the Follow button.
  const handleSeek = (target: SeekTarget) => {
    if (!timeMap) return;
    const seconds = timeMap.toVideoTime(target.qn);
    clock.seek(seconds);
    if (!readOnly) {
      void logPlaysenseStudioEvent({
        eventType: 'playsense_studio_seek_via_notation',
        classItemId,
        metadata: { qn: target.qn, video_seconds: seconds },
      });
    }
  };

  // Drag-on-staff → set A/B and arm the loop.
  const handleSelectRange = (range: SelectedRange) => {
    if (!timeMap) return;
    const startSec = timeMap.toVideoTime(range.startQn);
    const endSec = timeMap.toVideoTime(range.endQn);
    if (endSec <= startSec) return;
    clock.setLoopA(startSec);
    clock.setLoopB(endSec);
    clock.setLoopEnabled(true);
  };

  const handleStaffScrub = (ms: number) => {
    setIsFollowing(false);
    setViewMs(ms);
  };

  const handleFollow = () => {
    setIsFollowing(true);
    setViewMs(cursorMs);
  };

  // Save last position periodically and on unmount.
  useEffect(() => {
    if (readOnly) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    timer = setInterval(() => {
      const seconds = clock.getCurrentSeconds();
      if (seconds > 0) {
        void updateClassItemPosition(classItemId, Math.floor(seconds));
      }
    }, POSITION_SAVE_INTERVAL_MS);
    return () => {
      if (timer) clearInterval(timer);
      const seconds = clock.getCurrentSeconds();
      if (seconds > 0) {
        void updateClassItemPosition(classItemId, Math.floor(seconds));
      }
    };
  }, [classItemId, clock, readOnly]);

  // Analytics — one event on first mount + one each time playback transitions
  // from paused to playing. Fire-and-forget; errors are swallowed inside
  // logPlaysenseStudioEvent so they can't block the UI.
  const sentLoadedRef = useRef(false);
  const wasPlayingRef = useRef(false);
  useEffect(() => {
    if (readOnly) return;
    if (sentLoadedRef.current) return;
    sentLoadedRef.current = true;
    void logPlaysenseStudioEvent({
      eventType: 'playsense_studio_player_loaded',
      classItemId,
      metadata: {
        track_count: tracks.length,
        has_time_map: activeTimeMap !== null,
      },
    });
  }, [classItemId, tracks.length, activeTimeMap, readOnly]);
  useEffect(() => {
    if (readOnly) return;
    if (clock.isPlaying && !wasPlayingRef.current) {
      void logPlaysenseStudioEvent({
        eventType: 'playsense_studio_play',
        classItemId,
        metadata: { from_seconds: clock.currentSeconds, rate: clock.playbackRate },
      });
    }
    wasPlayingRef.current = clock.isPlaying;
  }, [clock.isPlaying, clock.currentSeconds, clock.playbackRate, classItemId, readOnly]);

  const { t } = useTranslation();
  const [lessonView, setLessonView] = useState<'both' | 'video' | 'score'>('both');
  useEffect(() => {
    try {
      const saved = localStorage.getItem('lmm-lesson-view');
      if (saved === 'both' || saved === 'video' || saved === 'score') setLessonView(saved);
    } catch { /* Storage may be unavailable. */ }
  }, []);
  const changeLessonView = (view: 'both' | 'video' | 'score') => {
    setLessonView(view);
    try { localStorage.setItem('lmm-lesson-view', view); } catch { /* Session choice still works. */ }
  };

  // Notation pane staff layout — stacked staves vs. single horizontal scroll
  // (only used when layout === 'split'). Pane geometry lives in SplitWorkspace.
  const [notationLayout, setNotationLayout] = useState<'wrapped' | 'scroll'>('wrapped');

  // Notation zoom (split layout) — pinch or slider scales the staff. 1 = default.
  const [zoom, setZoom] = useState(1);

  // ---- Shared building blocks (reused by both layouts) ----
  const videoEl = (
    <VideoStage
      ref={videoRef}
      src={videoUrl}
      poster={posterUrl}
      tracks={subtitleTracks}
      className={
        layout === 'split'
          ? 'h-full w-full [&_video]:object-contain'
          : 'aspect-video'
      }
      onFirstPlay={() => clock.play()}
    />
  );

  // Scrubber markers for the scored sections (only in the multi-section case).
  const sectionMarkers =
    sections && sections.length > 0
      ? sections
          .filter((s) => s.videoStartSeconds != null)
          .map((s) => ({
            startSeconds: s.videoStartSeconds as number,
            endSeconds: s.videoEndSeconds,
            label: s.label,
          }))
      : undefined;

  const transportEl = (
    <TransportBar
      currentSeconds={clock.currentSeconds}
      durationSeconds={clock.durationSeconds}
      isPlaying={clock.isPlaying}
      playbackRate={clock.playbackRate}
      onToggle={clock.toggle}
      onRestart={() => clock.seek(0)}
      onSeek={clock.seek}
      onRateChange={clock.setPlaybackRate}
      loopA={clock.loopA}
      loopB={clock.loopB}
      loopEnabled={clock.loopEnabled}
      onToggleLoop={() =>
        clock.loopEnabled ? clock.clearLoop() : clock.setLoopEnabled(true)
      }
      onClearLoop={clock.clearLoop}
      bpm={score.initialTempo}
      beatsPerMeasure={score.initialTimeSignature[0]}
      sectionMarkers={sectionMarkers}
      subtitleOptions={subtitleTracks.length > 0 ? subtitleTracks : undefined}
      activeSubtitleLang={activeSubtitleLang}
      onSubtitleLangChange={setActiveSubtitleLang}
    />
  );

  const tracksEl =
    hasNotation && tracks.length > 1 ? (
      <div className="flex flex-wrap gap-2">
        <span className="text-xs uppercase tracking-wider text-muted-foreground self-center mr-1">
          Track
        </span>
        {score.tracks.map((t, i) => (
          <button
            key={t.index}
            onClick={() => setActiveTrackIndex(i)}
            className={`px-2.5 py-1 rounded-md text-xs border transition ${
              i === activeTrackIndex
                ? 'bg-secondary text-secondary-foreground border-secondary'
                : 'bg-card border-border hover:bg-muted'
            }`}
          >
            {t.displayName}
          </button>
        ))}
      </div>
    ) : null;

  // Wrapped (stacked staves) only in the split workspace; the legacy stack
  // layout keeps the single horizontal scrolling line.
  const staffLayout: 'wrapped' | 'scroll' =
    layout === 'split' ? notationLayout : 'scroll';

  const staffEl = (
    <StaffRenderer
      score={score}
      trackIndex={activeTrackIndex}
      currentMs={cursorMs}
      viewMs={viewMs}
      loopAMs={loopAMs}
      loopBMs={loopBMs}
      layoutMode={staffLayout}
      zoom={layout === 'split' ? zoom : 1}
      showCursor={hasNotation || inTrailingGap || inLeadingGap}
      leadingGapMs={leadingGapMs}
      leadingGapLabel={interludes.leading ? `Notation begins at ${fmtClock(interludes.leading.endSeconds)}` : ''}
      trailingGapMs={trailingGapMs}
      trailingGapLabel={interludes.hasNext && interludes.trailing
        ? `Next score at ${fmtClock(interludes.trailing.endSeconds)}` : 'Continue watching your instructor.'}
      onSeek={handleSeek}
      onSelectRange={handleSelectRange}
      onDurationKnown={setTrackDurationMs}
    />
  );

  // The horizontal scrub bar only makes sense for the scrolling line; in
  // wrapped mode the whole piece is visible / vertically scrollable.
  const scrubEl =
    trackDurationMs > 0 && staffLayout === 'scroll' ? (
      <StaffScrubBar
        durationMs={trackDurationMs}
        viewMs={viewMs}
        playbackMs={cursorMs}
        isFollowing={isFollowing}
        onScrub={handleStaffScrub}
        onFollow={handleFollow}
      />
    ) : null;

  const clipsEl =
    !readOnly ? (
      <ClipsPanel
        classItemId={classItemId}
        loopA={clock.loopA}
        loopB={clock.loopB}
        playbackRate={clock.playbackRate}
        onLoadClip={(clip: PlaysenseStudioClip) => {
          clock.loadLoop(clip.startSeconds, clip.endSeconds, {
            rate: clip.playbackRate,
          });
        }}
      />
    ) : null;

  // ---- Split layout: resizable video | notation panes ----
  if (layout === 'split') {
    const measures = score.tracks[activeTrackIndex]?.measures.length ?? 0;
    const meta = [
      measures > 0 ? `${measures} measures` : null,
      `${score.initialTimeSignature[0]}/${score.initialTimeSignature[1]}`,
      `♩=${Math.round(score.initialTempo)}`,
    ]
      .filter(Boolean)
      .join('  ·  ');

    return (
      <div className="space-y-4">
        {/* Break out of the lesson page's px-4/md:px-8 padding for an
            edge-to-edge, viewport-filling workspace. */}
        <div className="-mx-4 md:-mx-8">
          <SplitWorkspace
            frame="bleed"
            visiblePane={lessonView === 'both' ? 'both' : lessonView === 'video' ? 'primary' : 'secondary'}
            primary={
            <>
              <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                {videoEl}
              </div>
              <div className="flex-shrink-0 border-t border-border bg-card px-3 py-2">
                {transportEl}
              </div>
            </>
          }
          secondaryHeader={({ orient, setOrient }) => (
            <div className="flex flex-shrink-0 items-center justify-between gap-2 border-b border-border bg-secondary px-3 py-2">
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[9.5px] font-bold uppercase leading-none tracking-[0.14em] text-primary">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(30_85%_55%/0.7)]" />
                  PlaySense Studio
                </div>
                <div className="mt-1 truncate font-heading text-[13.5px] font-bold tracking-tight">
                  {score.title || 'Notation'}
                </div>
                <div className="mt-0.5 truncate text-[10.5px] font-medium tracking-[0.02em] text-muted-foreground">
                  {meta}
                </div>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <div className="flex items-center gap-0.5 rounded-full border border-border p-0.5" role="group" aria-label={t('lessonView.label')}>
                  {(['video', 'score'] as const).map(view => {
                    const enabled = lessonView === 'both' || lessonView === view;
                    const onlyEnabled = lessonView === view;
                    return <button key={view} type="button" aria-pressed={enabled} disabled={onlyEnabled}
                      onClick={() => changeLessonView(enabled ? (view === 'video' ? 'score' : 'video') : 'both')}
                      className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${enabled ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted hover:text-foreground'} disabled:cursor-default`}>
                      {t(`lessonView.${view}Toggle`)}
                    </button>;
                  })}
                </div>
                {lessonView !== 'video' && <div className="flex items-center gap-1">
                  <NotationLayoutToggle value={notationLayout} onChange={setNotationLayout} />
                  {lessonView === 'both' && <OrientationToggle value={orient} onChange={setOrient} />}
                  {hasNotation && (
                    <DownloadMenu
                      score={score}
                      classItemTitle={classItemTitle ?? score.title}
                      sectionIndex={Math.max(0, normalizedSections.indexOf(displaySection))}
                      sectionCount={normalizedSections.length}
                      classItemId={classItemId}
                      readOnly={readOnly}
                    />
                  )}
                </div>}
              </div>
            </div>
          )}
            secondary={
              <>
              <div className="relative min-h-0 flex-1">
                <NotationZoomLayer
                  zoom={zoom}
                  onZoom={setZoom}
                  className="h-full space-y-2 overflow-auto p-3 pb-16"
                >
                  {tracksEl}
                  {staffEl}
                  {scrubEl}
                </NotationZoomLayer>
                <NotationZoomControl zoom={zoom} onZoom={setZoom} />
              </div>
              {lessonView === 'score' && <div className="flex-shrink-0 border-t border-border bg-card px-3 py-2">{transportEl}</div>}
              </>
            }
          />
        </div>

        {clipsEl}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {videoEl}
      {transportEl}
      {tracksEl}
      <div className="relative bg-card border border-border rounded-lg p-4 overflow-hidden space-y-3">
        {staffEl}
        {scrubEl}
      </div>
      {clipsEl}
    </div>
  );
}

function fmtClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function clampZoom(z: number): number {
  return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, z));
}

// Wraps the scrolling notation area and turns trackpad/Safari pinch gestures
// into zoom changes. Plain mouse-wheel still scrolls; only ctrl+wheel (the
// trackpad pinch signal) and Safari gesture events zoom. rAF-coalesced so a
// fast pinch doesn't rebuild the staff more than once per frame.
function NotationZoomLayer({
  zoom,
  onZoom,
  className,
  children,
}: {
  zoom: number;
  onZoom: (z: number) => void;
  className?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const zoomRef = useRef(zoom);
  const onZoomRef = useRef(onZoom);
  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);
  useEffect(() => {
    onZoomRef.current = onZoom;
  }, [onZoom]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let raf = 0;
    let pending: number | null = null;
    const flush = () => {
      raf = 0;
      if (pending !== null) {
        onZoomRef.current(pending);
        pending = null;
      }
    };
    const queue = (z: number) => {
      pending = clampZoom(z);
      if (!raf) raf = requestAnimationFrame(flush);
    };

    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return; // trackpad pinch / ctrl+wheel only
      e.preventDefault();
      queue(zoomRef.current * Math.exp(-e.deltaY * 0.0032));
    };
    el.addEventListener('wheel', onWheel, { passive: false });

    let gestureStart = 1;
    const onGestureStart = (e: Event) => {
      e.preventDefault();
      gestureStart = zoomRef.current;
    };
    const onGestureChange = (e: Event) => {
      e.preventDefault();
      const scale = (e as unknown as { scale: number }).scale;
      // Square the pinch ratio so the zoom rate is ~2× the raw gesture.
      queue(gestureStart * scale * scale);
    };
    el.addEventListener('gesturestart', onGestureStart as EventListener);
    el.addEventListener('gesturechange', onGestureChange as EventListener);

    return () => {
      if (raf) cancelAnimationFrame(raf);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', onGestureStart as EventListener);
      el.removeEventListener('gesturechange', onGestureChange as EventListener);
    };
  }, []);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}

// Floating zoom slider pinned to the notation pane's corner.
function NotationZoomControl({
  zoom,
  onZoom,
}: {
  zoom: number;
  onZoom: (z: number) => void;
}) {
  return (
    <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1 rounded-full border border-border bg-popover/90 px-1.5 py-1 shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={() => onZoom(clampZoom(zoom - 0.2))}
        title="Zoom out"
        aria-label="Zoom out"
        className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
      <input
        type="range"
        min={ZOOM_MIN}
        max={ZOOM_MAX}
        step={0.05}
        value={zoom}
        onChange={(e) => onZoom(Number(e.target.value))}
        aria-label="Notation zoom"
        className="h-1 w-20 cursor-pointer accent-primary sm:w-24"
      />
      <button
        type="button"
        onClick={() => onZoom(clampZoom(zoom + 0.2))}
        title="Zoom in"
        aria-label="Zoom in"
        className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => onZoom(1)}
        title="Reset zoom"
        className="min-w-[34px] rounded-full px-1 text-center text-[10px] font-semibold tabular-nums text-muted-foreground transition-colors hover:text-foreground"
      >
        {Math.round(zoom * 100)}%
      </button>
    </div>
  );
}

// Icon-only notation toggle: stacked staves ↔ single horizontal scroll.
function NotationLayoutToggle({
  value,
  onChange,
}: {
  value: 'wrapped' | 'scroll';
  onChange: (v: 'wrapped' | 'scroll') => void;
}) {
  return (
    <div
      role="group"
      aria-label="Notation layout"
      className="inline-flex flex-shrink-0 items-center gap-0.5 rounded-full border border-border bg-secondary p-0.5"
    >
      <button
        type="button"
        onClick={() => onChange('wrapped')}
        title="Stacked staves"
        aria-label="Stacked staves"
        className={`grid h-[26px] w-7 place-items-center rounded-full transition-colors ${
          value === 'wrapped'
            ? 'bg-primary/[0.16] text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <Rows3 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange('scroll')}
        title="Horizontal scroll"
        aria-label="Horizontal scroll"
        className={`grid h-[26px] w-7 place-items-center rounded-full transition-colors ${
          value === 'scroll'
            ? 'bg-primary/[0.16] text-primary'
            : 'text-muted-foreground hover:text-foreground'
        }`}
      >
        <MoveHorizontal className="h-4 w-4" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TimeMap construction
// ---------------------------------------------------------------------------

function buildTimeMap(
  score: ScoreDocument,
  trackIndex: number,
  payload: PlaysenseStudioPlayerTimeMap | null,
  videoDurationSeconds: number
): WaypointTimeMap | null {
  // 1) Real waypoints provided by an authored TimeMap (from M7 sync tools).
  if (payload && payload.waypoints.length >= 2) {
    const waypoints: Waypoint[] = payload.waypoints.map((w) => ({
      musicalPositionQN: w.musicalPositionQN,
      videoTimeSeconds: w.videoTimeSeconds,
      measureNumber: w.measureNumber,
      beatInMeasure: w.beatInMeasure,
    }));
    return new WaypointTimeMap(payload.id, payload.method as SyncMethod, waypoints);
  }

  // 2) Synthesized default — assume the video plays at the score's tempo.
  //    The score's first event is at video t=0; the score's last beat is at
  //    either (a) the video's actual duration if known, or (b) the score's
  //    tempo-derived duration. Whichever is larger to avoid clamping.
  const track = score.tracks[trackIndex];
  if (!track || track.measures.length === 0) return null;

  const totalQN = trackDurationQN(track, score);
  if (totalQN <= 0) return null;

  const tempoBasedSeconds = qnToTrackMs(track, score, totalQN) / 1000;
  const endVideoSeconds =
    videoDurationSeconds > 0
      ? Math.max(videoDurationSeconds, tempoBasedSeconds)
      : tempoBasedSeconds;

  if (endVideoSeconds <= 0) return null;

  const waypoints: Waypoint[] = [
    {
      musicalPositionQN: 0,
      videoTimeSeconds: 0,
      measureNumber: track.measures[0].number,
      beatInMeasure: 1,
    },
    {
      musicalPositionQN: totalQN,
      videoTimeSeconds: endVideoSeconds,
      measureNumber: track.measures[track.measures.length - 1].number,
      beatInMeasure: 1,
    },
  ];

  return new WaypointTimeMap('synthetic', 'tempo', waypoints);
}
