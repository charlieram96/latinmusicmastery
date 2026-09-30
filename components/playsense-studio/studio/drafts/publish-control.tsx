'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';


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

export function PublishControl({ studentHref }: { studentHref?: string } = {}) {
  const st = useStudioText();
  const { statuses, publish, discard, flush } = useStudioDrafts();
  const parts = Object.values(statuses).filter((s) => s.unpublished);
  const n = parts.length;
  const [published, setPublished] = useState(false);
  const [local, setLocal] = useState(false);
  useEffect(() => { setLocal(['localhost', '127.0.0.1'].includes(window.location.hostname)); }, []);
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

  const run = async (key: string, fn: () => Promise<{ error?: string }>, publishing = false) => {
    setBusy(key);
    setPublished(false);
    let res: { error?: string };
    try { res = await fn(); } catch { res = { error: st('Could not complete the operation. Try again.') }; }
    if (!res.error && publishing) setPublished(true);
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
      const ok = await run(ownerKey(p.owner), () => publish(p.owner), true);
      if (!ok) break;
    }
  };

  return (
    <div ref={boxRef} className="relative flex items-center gap-2">
      {n > 0 && (
        <span className="hidden text-xs text-muted-foreground md:inline">
          {st(n === 1 ? '1 unpublished change' : `${n} unpublished changes`)}
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
        {st("Publish ")}{n > 0 && <span className="st-publish-count">{n}</span>}
      </button>
      {published && <span role="status" className="text-xs text-primary">{st(n > 0 ? 'Part published. Other changes are still drafts.' : 'Published. Students can see the saved version.')}</span>}
      {studentHref && <a href={studentHref} target="_blank" rel="noopener noreferrer" className="st-chip text-primary" title={st('Opens the published lesson in student view')}>{st('Student view')}</a>}
      {local && studentHref && <a href={`https://latinmusicmastery.com${studentHref}`} target="_blank" rel="noopener noreferrer" className="st-chip text-primary">{st('Open official website')}</a>}
      {Object.entries(errors).filter(([key]) => !parts.some(part => ownerKey(part.owner) === key)).map(([key, error]) => <span key={key} role="alert" className="text-xs text-destructive">{error}</span>)}
      {open && (
        <div role="dialog" aria-label={st("Publish to students")} className="st-publish-pop">
          <p className="st-sec-label">{st("Publish to students")}</p>
          <p className="mb-2 text-xs text-muted-foreground">{st(local ? 'You are editing locally. Publish saves lesson content to the connected database; new app features still need a website deployment.' : 'Publish saves this lesson for students. Your admin tools remain private.')}</p>
          <ul className="flex flex-col gap-2">
            {parts.map((p) => {
              const key = ownerKey(p.owner);
              return (
                <li key={key} className="rounded-lg border border-border p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{st(p.label)}</span>
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
                      {st("Discard this draft")}</button>
                    <button
                      type="button"
                      className="st-chip is-on"
                      disabled={busy != null}
                      onClick={() => void run(key, () => publish(p.owner), true)}
                    >
                      {st("Publish")}</button>
                  </div>
                  {/* getPublishPreview (summarizeChanges) already returns
                      "No changes from the live version" as its own fallback
                      line — e.g. after undoing back to the live content,
                      which still counts as unpublished until published or
                      discarded. */}
                  <ul className="mt-1.5 text-xs text-muted-foreground">
                    {(preview[key] ?? []).map((line) => <li key={line}>{st(line)}</li>)}
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
              {st("Publish all")}</button>
          )}
        </div>
      )}
    </div>
  );
}
