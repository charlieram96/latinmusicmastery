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
import { useRef, useState, useTransition } from 'react';
import {
  getScoreSectionsForClassItem,
  createBlankSection,
  createSectionFromImport,
  deleteSection,
  type ClassItemScoreSection,
} from '@/app/actions/playsense-studio';
import { ScoreSectionEditor } from '@/components/playsense-studio/studio/score-section-editor';
import { ScoreImportDialog } from '@/components/playsense-studio/studio/score-import-dialog';
import { cn } from '@/lib/utils';

export interface VideoSectionsWorkspaceProps {
  classItemId: string;
  title: string;
  videoUrl: string | null;
  videoDurationSeconds: number | null;
  initialSections: ClassItemScoreSection[];
}

function fmt(s: number | null): string {
  if (s == null) return '—';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}

export function VideoSectionsWorkspace({
  classItemId,
  title,
  videoUrl,
  videoDurationSeconds,
  initialSections,
}: VideoSectionsWorkspaceProps) {
  const [sections, setSections] = useState(initialSections);
  const [selectedId, setSelectedId] = useState<string | null>(initialSections[0]?.sectionId ?? null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // Set by the import dialog's onConfirm so onImported can select the new section.
  const pendingSelectRef = useRef<string | undefined>(undefined);

  // App-shell portal slots (filled by the active ScoreSectionEditor).
  const [appBarEl, setAppBarEl] = useState<HTMLElement | null>(null);
  const [metaEl, setMetaEl] = useState<HTMLElement | null>(null);
  const [rightRailEl, setRightRailEl] = useState<HTMLElement | null>(null);
  const [transportEl, setTransportEl] = useState<HTMLElement | null>(null);
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

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-background text-foreground md:h-[100dvh]">
      {/* ---- App bar ---- */}
      <header className="st-appbar">
        <Link
          href="/admin/courses"
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
                              <span className="t">Import score at playhead</span>
                              <span className="d">Drop a MusicXML / MIDI file</span>
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
                    const name = s.label || s.scoreDocument.title;
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
                              className={cn(
                                'font-mono text-xs',
                                isSel ? 'text-primary' : 'text-muted-foreground'
                              )}
                            >
                              {i + 1}
                            </span>
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
                                {instrument} · {fmt(s.videoStartSeconds)}–{fmt(s.videoEndSeconds)}
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
              activeTimeMap={selected.activeTimeMap}
              videoUrl={videoUrl}
              videoDurationSeconds={videoDurationSeconds}
              onChanged={() => void refetch(selected.sectionId)}
              appBarEl={appBarEl}
              metaEl={metaEl}
              rightRailEl={rightRailEl}
              transportEl={transportEl}
              drawerEl={drawerEl}
              highwayOpen={highwayOpen}
            />
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <p className="max-w-sm rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground">
                No scored section selected. Add a blank section or import a score from the left, then
                scrub the video and use “Import at playhead” to place it where the instructor plays.
              </p>
            </div>
          )}
        </main>

        {/* Right rail: inspector (SyncPanel portals into this node). */}
        <aside
          ref={setRightRailEl}
          className="st-rail st-rail-right hidden w-72 shrink-0 flex-col gap-3 overflow-y-auto p-4 md:flex"
        />
      </div>

      {/* ---- Bottom: transport dock + highway drawer ---- */}
      <div ref={setTransportEl} className="shrink-0" />
      {highwayOpen && <div ref={setDrawerEl} className="st-drawer" style={{ height: 380 }} />}
    </div>
  );
}
