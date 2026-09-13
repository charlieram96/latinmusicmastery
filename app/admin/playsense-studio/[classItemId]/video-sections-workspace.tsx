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

import { ArrowLeft, FileUp, Loader2, PanelBottom, Plus, Rows3, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import {
  getScoreSectionsForClassItem,
  createBlankSection,
  createSectionFromImport,
  deleteSection,
  type ClassItemScoreSection,
} from '@/app/actions/playsense-studio';
import { ScoreSectionEditor } from '@/components/playsense-studio/studio/score-section-editor';
import { ScoreImportDialog } from '@/components/playsense-studio/studio/score-import-dialog';
import { sectionColor, type LaneSection } from '@/components/playsense-studio/sync/sections-lane';
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

export function VideoSectionsWorkspace({
  classItemId,
  backHref = '/admin/courses',
  title,
  videoUrl,
  videoDurationSeconds,
  initialTrim,
  initialSections,
  appBarExtra,
}: VideoSectionsWorkspaceProps) {
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

  const refetch = async (selectId?: string) => {
    const res = await getScoreSectionsForClassItem(classItemId);
    if (res.error || !res.data) {
      setError(res.error ?? 'Failed to load sections');
      return;
    }
    setSections(res.data);
    if (selectId !== undefined) {
      setSelectedId(selectId);
    } else if (!res.data.some((s) => s.sectionId === selectedId)) {
      setSelectedId(res.data[0]?.sectionId ?? null);
    }
  };

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

  // Timeline-lane view of the sections (the active one renders live from its
  // markers inside SyncPanel; siblings use their published video ranges).
  const laneSections: LaneSection[] = sections.map((s) => ({
    sectionId: s.sectionId,
    // The section name is the score title (the only name field); `label` is a
    // stale creation-time snapshot and is intentionally ignored.
    label: s.scoreDocument.title,
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
          {/* The active section editor portals its Save/undo/redo/replace here. */}
          <div ref={setAppBarEl} className="flex items-center gap-2" />
        </div>
      </header>

      {/* ---- Body: sections + meta rail · center editor · inspector rail ---- */}
      <div className="flex min-h-0 flex-1">
        <aside className="st-rail st-rail-left hidden w-72 shrink-0 flex-col lg:flex">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            {/* Reference video monitor (SyncPanel portals it into this slot). */}
            <div ref={setMonitorEl} className="shrink-0 empty:hidden" />

            {/* Scored sections */}
            <div className="flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <span className="st-sec-label">Scored sections</span>
                <span className="font-mono text-xs text-muted-foreground">{sections.length}</span>
              </div>
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
                    const name = s.scoreDocument.title;
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
                              <span
                                className={cn(
                                  'block truncate text-[13px] font-medium',
                                  isSel ? 'text-primary' : 'text-foreground'
                                )}
                              >
                                {name}
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

            {/* Score meta (the active section editor portals its form here). */}
            {selected && (
              <div className="border-t border-border pt-4">
                <span className="st-sec-label">Score</span>
                <div ref={setMetaEl} className="mt-3" />
              </div>
            )}

            {/* Inspector: selected note + sync status (SyncPanel portals here). */}
            {selected && (
              <div
                ref={setInspectorEl}
                className="flex flex-col gap-3 border-t border-border pt-4 empty:hidden"
              />
            )}
          </div>
        </aside>

        {/* Center: the active section editor (or an empty state). */}
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden p-3 md:p-4">
          {selected ? (
            <ScoreSectionEditor
              key={`${selected.sectionId}:${selected.scoreDocument.id}`}
              classItemId={classItemId}
              sectionId={selected.sectionId}
              scoreDocumentId={selected.scoreDocument.id}
              initialScore={selected.scoreDocument.parsedScore}
              // Seed the sync markers from the admin's autosaved draft when present,
              // else the last Published map. Students only ever get activeTimeMap.
              activeTimeMap={selected.draftTimeMap ?? selected.activeTimeMap}
              hasDraft={selected.draftTimeMap != null}
              videoUrl={videoUrl}
              videoDurationSeconds={videoDurationSeconds}
              initialMetronomeAnchorSeconds={selected.metronomeAnchorSeconds}
              trim={trim}
              onTrimDrag={handleTrimDrag}
              onChanged={() => void refetch(selected.sectionId)}
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

      </div>

      {/* ---- Bottom: transport dock + highway drawer ---- */}
      <div ref={setTransportEl} className="shrink-0" />
      {highwayOpen && <div ref={setDrawerEl} className="st-drawer" style={{ height: 380 }} />}
    </div>
  );
}
