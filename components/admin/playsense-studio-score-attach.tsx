'use client'

import { AdminText } from '@/components/admin/admin-text'
;

// Admin class-item control for PlaySense Studio. Building/importing a score and
// syncing it all happen inside the Studio now — this just shows whether a score
// is attached and links into the Studio (and offers detach).

import { CheckCircle2, ExternalLink, FileMusic, Loader2, X } from 'lucide-react';
import Link, { useLinkStatus } from 'next/link';
import { useState, useTransition } from 'react';
import { detachScoreFromClassItem } from '@/app/actions/playsense-studio';

function StudioLinkLabel({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus();
  return <>
    {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <ExternalLink aria-hidden className="h-4 w-4" />}
    <span role={pending ? 'status' : undefined}>{pending ? <AdminText text={"Opening PlaySense Studio…"} /> : children}</span>
  </>;
}

interface PlaysenseStudioScoreAttachProps {
  classItemId: string;
  /** Current score_document_id from the class_item, if attached. */
  currentScoreDocumentId: string | null;
  /** Class-item type. VIDEO lessons use multiple scored sections (managed in the
   *  Studio), so the single-score attach/detach UI doesn't apply to them. */
  itemType?: string;
  /** Called after a successful detach so the parent sheet can refresh. */
  onChanged?: () => void;
}

export function PlaysenseStudioScoreAttach({
  classItemId,
  currentScoreDocumentId,
  itemType,
  onChanged,
}: PlaysenseStudioScoreAttachProps) {
  const [hasAttached, setHasAttached] = useState(currentScoreDocumentId !== null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const studioHref = `/admin/playsense-studio/${classItemId}`;

  // VIDEO lessons hold MULTIPLE scored sections, authored inside the Studio.
  if (itemType === 'VIDEO') {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <FileMusic className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-medium"><AdminText text={"PlaySense Studio Sections"} /></h4>
        </div>
        <Link
          href={studioHref}
          className="inline-flex w-full items-center justify-center gap-2 px-4 py-2 rounded-md border border-border hover:bg-muted transition text-sm"
        >
          <StudioLinkLabel><AdminText text={"Open PlaySense Studio — manage scored sections"} /></StudioLinkLabel>
        </Link>
        <p className="text-xs text-muted-foreground">
          A video can have multiple scored sections, each placed where the instructor plays. Add,
          build, and sync them in PlaySense Studio; students see each section&apos;s notation only
          while the video is inside its range.
        </p>
      </div>
    );
  }

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
        <h4 className="font-medium"><AdminText text={"PlaySense Studio Score"} /></h4>
      </div>

      {hasAttached ? (
        <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-md border border-border bg-muted/30 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <CheckCircle2 className="w-4 h-4 text-primary" /> <AdminText text={"A score is attached to this class item."} /> </span>
          <div className="flex items-center gap-2">
            <Link
              href={studioHref}
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              <StudioLinkLabel><AdminText text={"Open PlaySense Studio"} /></StudioLinkLabel>
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
          <StudioLinkLabel><AdminText text={"Open PlaySense Studio to add a score"} /></StudioLinkLabel>
        </Link>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}

      <p className="text-xs text-muted-foreground"> <AdminText text={"In PlaySense Studio you import or create the score, build the notation, and sync it to the video. Once attached, students see the PlaySense Studio player on this lesson."} /> </p>
    </div>
  );
}
