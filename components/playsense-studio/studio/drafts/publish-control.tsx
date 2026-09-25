'use client';

// App-bar Publish control: the "N unpublished changes" count, a pulsing
// Publish button with a count badge, and a popover listing every unpublished
// part with what changed, a per-part Publish/Discard, and Publish all.
// Students never see a draft until one of these actions runs — see
// drafts-context.tsx's publish/discard, which flush the pending autosave
// first so the last edit is never lost to a race with Publish.
import { Loader2, Upload } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { getPublishPreview } from '@/app/actions/studio-drafts';
import { ownerKey } from '@/lib/playsense-studio/drafts/types';
import { useStudioDrafts } from './drafts-context';

export function PublishControl() {
  const { statuses, publish, discard, flush } = useStudioDrafts();
  const parts = Object.values(statuses).filter((s) => s.unpublished);
  const n = parts.length;
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    const owners = parts.map((p) => p.owner);
    // Flush pending autosaves first, so the preview diffs the last edit rather
    // than the draft row as it stood before the debounce fired. A failed flush
    // still shows the preview; Publish itself refuses past that error.
    void (async () => {
      await Promise.all(owners.map((o) => flush(ownerKey(o)).catch(() => ({}))));
      if (!live) return;
      const res = await getPublishPreview(owners);
      if (live && res.data) setPreview(res.data);
    })();
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => { live = false; document.removeEventListener('mousedown', onDown); };
    // Deliberately only re-runs on open/close: `parts` is re-derived from
    // `statuses` every render, so it can't be a stable dependency itself
    // (and `flush` is a stable callback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => { if (n === 0) setOpen(false); }, [n]);

  const run = async (key: string, fn: () => Promise<{ error?: string }>) => {
    setBusy(key);
    const res = await fn();
    setBusy(null);
    setErrors((e) => {
      const next = { ...e };
      if (res.error) next[key] = res.error; else delete next[key];
      return next;
    });
    return !res.error;
  };

  const publishAll = async () => {
    for (const p of parts) {
      const ok = await run(ownerKey(p.owner), () => publish(p.owner));
      if (!ok) break;
    }
  };

  return (
    <div ref={boxRef} className="relative flex items-center gap-2">
      {n > 0 && (
        <span className="hidden text-xs text-muted-foreground md:inline">
          {n === 1 ? '1 unpublished change' : `${n} unpublished changes`}
        </span>
      )}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={n === 0}
        className={`st-publish${n > 0 ? ' is-pending' : ''}`}
        aria-haspopup="dialog"
        aria-expanded={open}
      >
        <Upload className="h-4 w-4" />
        Publish
        {n > 0 && <span className="st-publish-count">{n}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Publish to students" className="st-publish-pop">
          <p className="st-sec-label">Publish to students</p>
          <ul className="flex flex-col gap-2">
            {parts.map((p) => {
              const key = ownerKey(p.owner);
              return (
                <li key={key} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{p.label}</span>
                    {busy === key && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                    <button
                      type="button"
                      className="st-chip"
                      disabled={busy != null}
                      onClick={() => {
                        if (!window.confirm(`Discard the unpublished changes to "${p.label}"? The live version stays as it is.`)) return;
                        void run(key, () => discard(p.owner));
                      }}
                    >
                      Discard this draft
                    </button>
                    <button
                      type="button"
                      className="st-chip is-on"
                      disabled={busy != null}
                      onClick={() => void run(key, () => publish(p.owner))}
                    >
                      Publish
                    </button>
                  </div>
                  {/* getPublishPreview (summarizeChanges) already returns
                      "No changes from the live version" as its own fallback
                      line — e.g. after undoing back to the live content,
                      which still counts as unpublished until published or
                      discarded. */}
                  <ul className="mt-1.5 text-xs text-muted-foreground">
                    {(preview[key] ?? []).map((line) => <li key={line}>{line}</li>)}
                  </ul>
                  {errors[key] && <p className="mt-1.5 text-xs text-destructive">{errors[key]}</p>}
                </li>
              );
            })}
          </ul>
          {n >= 2 && (
            <button
              type="button"
              className="st-publish is-pending mt-2 w-full justify-center"
              disabled={busy != null}
              onClick={() => void publishAll()}
            >
              Publish all
            </button>
          )}
        </div>
      )}
    </div>
  );
}
