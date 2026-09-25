'use client';

// PlaySense Studio — multiple scored sections for one VIDEO lesson.
//
// A video is mostly the instructor talking, with a few stretches where they play
// and we want notation on screen. Each such stretch is a "section" owning its own
// score + sync. This workspace is the app-shell: a left rail lists the sections
// (and holds the active section's score meta), the center hosts the active
// section's editor, the right rail shows the inspector, and the transport docks
// at the bottom. ScoreSectionEditor (keyed, one at a time) owns the score state
// and portals its chrome into these shell slots.

import { Activity, ArrowLeft, FileUp, Loader2, Music, PanelBottom, Plus, Rows3, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  getStudioScoreSectionsForClassItem,
  createBlankSection,
  createSectionFromImport,
  deleteSection,
  type ClassItemScoreSection,
} from '@/app/actions/playsense-studio';
import { ScoreSectionEditor } from '@/components/playsense-studio/studio/score-section-editor';
import { ScoreImportDialog } from '@/components/playsense-studio/studio/score-import-dialog';
import { sectionColor, type LaneSection } from '@/components/playsense-studio/sync/sections-lane';
import { HoverRail } from '@/components/playsense-studio/studio/shell/hover-rail';
import { FloatingVideo } from '@/components/playsense-studio/studio/shell/floating-video';
import { StudioDraftsProvider, useStudioDrafts } from '@/components/playsense-studio/studio/drafts/drafts-context';
import { UnpublishedDot } from '@/components/playsense-studio/studio/drafts/unpublished-dot';
import { PublishControl } from '@/components/playsense-studio/studio/drafts/publish-control';
import { sectionSeed } from '@/lib/playsense-studio/drafts/seed';
import { cn } from '@/lib/utils';
import { setTrimIn, setTrimOut, type MediaTrim } from '@/lib/playsense-studio/clip-model';
import { updateClassItemVideoTrim } from '@/app/actions/playsense-studio';

export interface VideoSectionsWorkspaceProps {
  classItemId: string;
  /** Where the app-bar back link lands (the owning course's overview). */
  backHref?: string;
  title: string;
  videoUrl: string | null;
  videoDurationSeconds: number | null;
  /** Usable region of the lesson video. Class-item level, not per section. */
  initialTrim?: MediaTrim;
  initialSections: ClassItemScoreSection[];
  /** Extra app-bar content (e.g. the exercise Watch/Exercise part toggle). */
  appBarExtra?: React.ReactNode;
}

function fmt(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function VideoSectionsWorkspace(props: VideoSectionsWorkspaceProps) {
  const { initialSections } = props;
  return (
    <StudioDraftsProvider
      owners={initialSections.map((s) => ({
        owner: { kind: 'section', id: s.sectionId },
        label: s.studioDraft?.score.title ?? s.scoreDocument.title,
        unpublished: s.studioDraft != null,
      }))}
    >
      <VideoSectionsBody {...props} />
    </StudioDraftsProvider>
  );
}

function VideoSectionsBody({
  classItemId,
  backHref = '/admin/courses',
  title,
  videoUrl,
  videoDurationSeconds,
  initialTrim,
  initialSections,
  appBarExtra,
}: VideoSectionsWorkspaceProps) {
  const { statuses, register } = useStudioDrafts();
  const [sections, setSections] = useState(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(initialSections[0]?.sectionId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Set by the import dialog's onConfirm so onImported can select the new section.
  const pendingSelectRef = useRef<string | undefined>(undefined);

  // The trim belongs to the VIDEO, which outlives any one section editor, so
  // it is owned here rather than inside ScoreSectionEditor.
  const [trim, setTrim] = useState<MediaTrim>(
    initialTrim ?? { trimInSeconds: 0, trimOutSeconds: null }
  );
  const trimTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const trimRef = useRef(trim);
  trimRef.current = trim;

  const persistTrim = useCallback(() => {
    void updateClassItemVideoTrim({
      classItemId,
      trimInSeconds: trimRef.current.trimInSeconds,
      trimOutSeconds: trimRef.current.trimOutSeconds,
      durationSeconds: videoDurationSeconds,
    });
  }, [classItemId, videoDurationSeconds]);

  const handleTrimDrag = useCallback(
    (edge: 'in' | 'out', videoTimeSeconds: number) => {
      setTrim((prev) =>
        edge === 'in'
          ? setTrimIn(prev, videoDurationSeconds, videoTimeSeconds)
          : setTrimOut(prev, videoDurationSeconds, videoTimeSeconds)
      );
      if (trimTimer.current) clearTimeout(trimTimer.current);
      trimTimer.current = setTimeout(persistTrim, 500);
    },
    [videoDurationSeconds, persistTrim]
  );

  useEffect(
    () => () => {
      if (trimTimer.current) {
        clearTimeout(trimTimer.current);
        persistTrim();
      }
    },
    [persistTrim]
  );

  // App-shell portal slots (filled by the active ScoreSectionEditor).
  const [appBarEl, setAppBarEl] = useState<HTMLElement | null>(null);
  const [metaEl, setMetaEl] = useState<HTMLElement | null>(null);
  const [inspectorEl, setInspectorEl] = useState<HTMLElement | null>(null);
  const [transportEl, setTransportEl] = useState<HTMLElement | null>(null);
  const [monitorEl, setMonitorEl] = useState<HTMLElement | null>(null);
  const [drawerEl, setDrawerEl] = useState<HTMLElement | null>(null);
  const [highwayOpen, setHighwayOpen] = useState(false);
  // "New section" popover (Build measures / Import score at playhead).
  const [newSecOpen, setNewSecOpen] = useState(false);

  const refetch = useCallback(async (selectId?: string) => {
    const res = await getStudioScoreSectionsForClassItem(classItemId);
    if (res.error || !res.data) {
      setError(res.error ?? 'Failed to load sections');
      return;
    }
    const data = res.data;
    setSections(data);
    if (selectId !== undefined) {
      setSelectedId(selectId);
    } else {
      setSelectedId((cur) => (data.some((s) => s.sectionId === cur) ? cur : (data[0]?.sectionId ?? null)));
    }
  }, [classItemId]);

  // Refetch (reseeding sections not currently mounted) whenever another part of
  // the Studio publishes or discards that section's draft. refetch() with no
  // argument already keeps whatever is currently selected (falling back to the
  // first section only if that one's gone) — re-registers only when the set of
  // section ids changes, not on every render.
  const sectionIdsKey = sections.map((s) => s.sectionId).join('|');
  useEffect(() => {
    const unregisters = sections.map((s) => register(`section:${s.sectionId}`, { changed: () => void refetch() }));
    return () => unregisters.forEach((u) => u());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIdsKey, register, refetch]);

  const addBlank = () => {
    setError(null);
    startTransition(async () => {
      const res = await createBlankSection({ classItemId });
      if (res.error || !res.sectionId) {
        setError(res.error ?? 'Failed to add section');
        return;
      }
      await refetch(res.sectionId);
    });
  };

  const remove = (sectionId: string) => {
    if (!window.confirm('Delete this section and its score? This cannot be undone.')) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteSection(sectionId);
      if (res.error) {
        setError(res.error);
        return;
      }
      await refetch();
    });
  };

  const selected = sections.find((s) => s.sectionId === selectedId) ?? null;
  // What the editor opens on: the section's unpublished draft, else the live
  // content students see.
  const seed = selected ? sectionSeed(selected) : null;

  // The section's display name: the live title while its editor is (or has
  // been) open — useStudioDraft's own effect keeps statuses[key].label in
  // step with it on every render — else the cached draft title, else the
  // last-fetched live title. `s.label` (a stale creation-time snapshot) is
  // intentionally never used.
  const sectionLabel = (s: ClassItemScoreSection) =>
    statuses[`section:${s.sectionId}`]?.label || s.studioDraft?.score.title || s.scoreDocument.title;

  // Timeline-lane view of the sections (the active one renders live from its
  // markers inside SyncPanel; siblings use their published video ranges).
  const laneSections: LaneSection[] = sections.map((s) => ({
    sectionId: s.sectionId,
    label: sectionLabel(s),
    startSeconds: s.videoStartSeconds,
    endSeconds: s.videoEndSeconds,
  }));

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-background text-foreground md:h-[100dvh]">
      {/* ---- App bar ---- */}
      <header className="st-appbar">
        <Link
          href={backHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="hidden sm:inline">Admin</span>
        </Link>
        <span className="hidden text-muted-foreground/40 sm:inline">/</span>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-semibold">{title}</span>
          <span className="hidden shrink-0 rounded-md border border-border bg-muted px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground md:inline">
            PlaySense Studio
          </span>
        </div>

        {appBarExtra}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setHighwayOpen((o) => !o)}
            disabled={!selected}
            className={cn('st-chip', highwayOpen && 'is-on')}
            title="Toggle the student highway preview"
            aria-pressed={highwayOpen}
          >
            <PanelBottom className="h-4 w-4" />
            <span className="hidden sm:inline">Preview</span>
          </button>
          <PublishControl />

          {/* The active section editor portals its Save/undo/redo/replace here. */}
          <div ref={setAppBarEl} className="flex items-center gap-2" />
        </div>
      </header>

      {/* ---- Body: hover rail (video · sections · meta · inspector) · center editor ---- */}
      <div className="st-work">
        <HoverRail
          sections={[
            {
              id: 'sections',
              label: 'Scored sections',
              icon: Rows3,
              content: (
                <div className="flex flex-col gap-2.5">
                  <span className="font-mono text-xs text-muted-foreground">{sections.length}</span>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setNewSecOpen((v) => !v)}
                      disabled={isPending}
                      className="st-btn-primary st-newsec-btn"
                      aria-expanded={newSecOpen}
                    >
                      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                      New section
                    </button>
                    {newSecOpen && (
                      <>
                        <div className="st-pop-scrim" onClick={() => setNewSecOpen(false)} />
                        <div className="st-pop">
                          <span className="st-pop-label">Create a section by…</span>
                          <button
                            type="button"
                            className="st-pop-item"
                            onClick={() => {
                              setNewSecOpen(false);
                              addBlank();
                            }}
                          >
                            <span className="ic">
                              <Rows3 className="h-[17px] w-[17px]" />
                            </span>
                            <span className="tx">
                              <span className="t">Build measures</span>
                              <span className="d">Start empty and add bars by hand</span>
                            </span>
                          </button>
                          <ScoreImportDialog
                            classItemId={classItemId}
                            mode="section"
                            onConfirm={async (score, filename) => {
                              const res = await createSectionFromImport({
                                classItemId,
                                scoreDocument: score,
                                sourceFilename: filename,
                              });
                              if (res.sectionId) pendingSelectRef.current = res.sectionId;
                              return res;
                            }}
                            onImported={() => {
                              const id = pendingSelectRef.current;
                              pendingSelectRef.current = undefined;
                              setNewSecOpen(false);
                              void refetch(id);
                            }}
                            trigger={
                              <button type="button" className="st-pop-item">
                                <span className="ic">
                                  <FileUp className="h-[17px] w-[17px]" />
                                </span>
                                <span className="tx">
                                  <span className="t">Import a score</span>
                                  <span className="d">Drop a MusicXML / MIDI file, then place it on the timeline</span>
                                </span>
                              </button>
                            }
                          />
                        </div>
                      </>
                    )}
                  </div>

                  {error && (
                    <p className="rounded-md border border-destructive/30 bg-destructive/10 px-2.5 py-1.5 text-xs text-destructive">
                      {error}
                    </p>
                  )}

                  {sections.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-xs text-muted-foreground">
                      No scored sections yet. Add a blank section or import a score.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-1">
                      {sections.map((s, i) => {
                        const isSel = s.sectionId === selectedId;
                        const instrument = s.tracks[0]?.instrument ?? '—';
                        const name = sectionLabel(s);
                        const unpublished = statuses[`section:${s.sectionId}`]?.unpublished;
                        return (
                          <li key={s.sectionId}>
                            <div
                              className={cn(
                                'group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 transition',
                                isSel
                                  ? 'border-primary/40 bg-primary/10'
                                  : 'border-transparent hover:bg-muted/50'
                              )}
                            >
                              <button
                                onClick={() => setSelectedId(s.sectionId)}
                                className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                              >
                                <span
                                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                                  style={{ background: sectionColor(i) }}
                                  aria-hidden
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="flex items-center gap-1.5">
                                    <span
                                      className={cn(
                                        'truncate text-[13px] font-medium',
                                        isSel ? 'text-primary' : 'text-foreground'
                                      )}
                                    >
                                      {name}
                                    </span>
                                    {unpublished && <UnpublishedDot />}
                                  </span>
                                  <span className="block truncate font-mono text-[10px] text-muted-foreground">
                                    {instrument} ·{' '}
                                    {s.videoStartSeconds == null ? (
                                      <span className="rounded bg-muted px-1 py-px text-[9px] font-semibold uppercase tracking-wide">
                                        Not placed
                                      </span>
                                    ) : (
                                      <>{fmt(s.videoStartSeconds)}–{fmt(s.videoEndSeconds)}</>
                                    )}
                                  </span>
                                </span>
                              </button>
                              <button
                                onClick={() => remove(s.sectionId)}
                                className="rounded-md p-1.5 text-muted-foreground opacity-0 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                                aria-label="Delete section"
                                title="Delete section"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              ),
            },
            ...(selected ? [{ id: 'score', label: 'Score', icon: Music, content: <div ref={setMetaEl} /> }] : []),
            ...(selected
              ? [{ id: 'sync', label: 'Sync status', icon: Activity, content: <div ref={setInspectorEl} className="flex flex-col gap-3" /> }]
              : []),
          ]}
        />

        {/* Center: the active section editor (or an empty state). */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 md:p-4">
          {selected && seed ? (
            <ScoreSectionEditor
              key={`${selected.sectionId}:${selected.scoreDocument.id}`}
              classItemId={classItemId}
              sectionId={selected.sectionId}
              scoreDocumentId={selected.scoreDocument.id}
              // Seeded from the admin's unpublished draft when present, else the
              // last Published content. Students only ever get the live rows.
              initialScore={seed.score}
              initialTiming={seed.timing}
              videoUrl={videoUrl}
              videoDurationSeconds={videoDurationSeconds}
              trim={trim}
              onTrimDrag={handleTrimDrag}
              onChanged={() => void refetch(selected.sectionId)}
              onDraftContent={(c) => {
                const id = selected.sectionId;
                setSections((prev) =>
                  prev.map((s) => (s.sectionId === id ? { ...s, studioDraft: { ...c, updatedAt: new Date().toISOString() } } : s))
                );
              }}
              sections={laneSections}
              onSelectSection={setSelectedId}
              appBarEl={appBarEl}
              metaEl={metaEl}
              inspectorEl={inspectorEl}
              transportEl={transportEl}
              monitorEl={monitorEl}
              drawerEl={drawerEl}
              highwayOpen={highwayOpen}
            />
          ) : (
            <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4">
              {/* No scored sections yet — still let the author watch the demo. */}
              <video
                src={videoUrl ?? undefined}
                controls
                playsInline
                preload="metadata"
                className="max-h-[60vh] w-full max-w-3xl rounded-lg bg-black"
              />
              <p className="max-w-sm text-center text-sm text-muted-foreground">
                This is the demo video. Add a blank section or import a score from the left, then
                scrub the video and use “Place score at playhead” to drop notation where the
                instructor plays.
              </p>
            </div>
          )}
        </main>

        {/* Only when a section is selected does SyncPanel actually portal a
            monitor into monitorEl — the no-sections empty state shows its own
            full-size inline video instead. */}
        {selected && videoUrl && <FloatingVideo label="Reference" onBodyEl={setMonitorEl} />}
      </div>

      {/* ---- Bottom: transport dock + highway drawer ---- */}
      <div ref={setTransportEl} className="shrink-0" />
      {highwayOpen && <div ref={setDrawerEl} className="st-drawer" style={{ height: 380 }} />}
    </div>
  );
}
