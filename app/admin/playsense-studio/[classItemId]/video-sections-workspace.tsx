'use client';

// PlaySense Studio — multiple scored sections for one VIDEO lesson.
//
// A video is mostly the instructor talking, with a few stretches where they play
// and we want notation on screen. Each such stretch is a "section" owning its own
// score + sync. This workspace lists the sections (with their video time-ranges)
// and edits ONE at a time via ScoreSectionEditor. "Add section" creates a new one;
// the admin scrubs the video and uses "Import at playhead" to place it.

import { ArrowLeft, FileUp, Loader2, Plus, Trash2 } from 'lucide-react';
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
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-border bg-card px-6 py-3">
        <Link
          href="/admin/courses"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Admin
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-base font-semibold">PlaySense Studio — {title}</h1>
      </header>

      <main className="space-y-6 px-6 py-6">
        {error && (
          <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Section list */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Scored sections
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={addBlank}
                disabled={isPending}
                className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Add blank section
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
                  void refetch(id);
                }}
                trigger={
                  <button
                    type="button"
                    className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-sm transition hover:bg-muted"
                  >
                    <FileUp className="h-4 w-4" />
                    Import as new section
                  </button>
                }
              />
            </div>
          </div>

          {sections.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
              No scored sections yet. Add a blank section or import a score, then scrub the video and
              use “Import at playhead” to place it where the instructor plays.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {sections.map((s, i) => {
                const isSel = s.sectionId === selectedId;
                const instrument = s.tracks[0]?.instrument ?? '—';
                const name = s.label || s.scoreDocument.title;
                return (
                  <li key={s.sectionId}>
                    <div
                      className={cn(
                        'flex items-center gap-3 rounded-lg border px-3 py-2 text-sm transition',
                        isSel ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                      )}
                    >
                      <span className="font-mono text-xs text-muted-foreground">#{i + 1}</span>
                      <span className="tabular-nums text-xs text-muted-foreground">
                        {fmt(s.videoStartSeconds)}–{fmt(s.videoEndSeconds)}
                      </span>
                      <span className="truncate font-medium">{name}</span>
                      <span className="text-xs text-muted-foreground">{instrument}</span>
                      <div className="ml-auto flex items-center gap-1.5">
                        {!isSel && (
                          <button
                            onClick={() => setSelectedId(s.sectionId)}
                            className="rounded-md border border-border px-2 py-1 text-xs transition hover:bg-muted"
                          >
                            Edit
                          </button>
                        )}
                        <button
                          onClick={() => remove(s.sectionId)}
                          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          aria-label="Delete section"
                          title="Delete section"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Selected section editor — remounts on section or score swap. */}
        {selected && (
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
          />
        )}
      </main>
    </div>
  );
}
