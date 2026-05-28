'use client';

// Admin class-item control for PlaySense Studio. Building/importing a score and
// syncing it all happen inside the Studio now — this just shows whether a score
// is attached and links into the Studio (and offers detach).

import { CheckCircle2, ExternalLink, FileMusic, X } from 'lucide-react';
import Link from 'next/link';
import { useState, useTransition } from 'react';
import { detachScoreFromClassItem } from '@/app/actions/playsense-studio';

interface PlaysenseStudioScoreAttachProps {
  classItemId: string;
  /** Current score_document_id from the class_item, if attached. */
  currentScoreDocumentId: string | null;
  /** Called after a successful detach so the parent sheet can refresh. */
  onChanged?: () => void;
}

export function PlaysenseStudioScoreAttach({
  classItemId,
  currentScoreDocumentId,
  onChanged,
}: PlaysenseStudioScoreAttachProps) {
  const [hasAttached, setHasAttached] = useState(currentScoreDocumentId !== null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const studioHref = `/admin/playsense-studio/${classItemId}`;

  const handleDetach = () => {
    setError(null);
    startTransition(async () => {
      const result = await detachScoreFromClassItem(classItemId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setHasAttached(false);
      onChanged?.();
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FileMusic className="w-4 h-4 text-muted-foreground" />
        <h4 className="font-medium">PlaySense Studio Score</h4>
      </div>

      {hasAttached ? (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border bg-muted/30 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            A score is attached to this class item.
          </span>
          <div className="flex items-center gap-2">
            <Link
              href={studioHref}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Open PlaySense Studio
            </Link>
            <button
              type="button"
              onClick={handleDetach}
              disabled={isPending}
              className="p-1 rounded border border-border hover:bg-muted disabled:opacity-50"
              aria-label="Detach score"
              title="Detach score"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <Link
          href={studioHref}
          className="inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-muted transition text-sm"
        >
          <ExternalLink className="w-4 h-4" />
          Open PlaySense Studio to add a score
        </Link>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground">
        In PlaySense Studio you import or create the score, build the notation, and sync it to the
        video. Once attached, students see the PlaySense Studio player on this lesson.
      </p>
    </div>
  );
}
