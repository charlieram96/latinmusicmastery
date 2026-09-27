'use client';

// Per-part History: lists a section/exercise/song's published versions and
// drafts (newest first, the live one marked) and lets an admin restore any of
// them as the new draft. Restore is routed through the same per-owner save
// queue useStudioDraft's autosave and ctx.discard use, so it can't race an
// autosave still on the wire — see drafts-context.tsx's discard for the same
// pattern this mirrors.
import { History, Loader2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { listStudioVersions, restoreStudioVersion, type StudioVersionListItem } from '@/app/actions/studio-drafts';
import { queueStudioSave } from '@/lib/playsense-studio/save-queue';
import { ownerKey, type StudioDraftOwner } from '@/lib/playsense-studio/drafts/types';
import { useStudioDrafts } from './drafts-context';

export function HistoryPanel({ owner, iconOnly }: { owner: StudioDraftOwner; iconOnly?: boolean }) {
  const { notifyAdopt, setStatus } = useStudioDrafts();
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<StudioVersionListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    let live = true;
    setRows(null);
    void listStudioVersions(owner).then((res) => {
      if (!live) return;
      if (res.error) setError(res.error); else setRows(res.data ?? []);
    });
    const onDown = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => { live = false; document.removeEventListener('mousedown', onDown); };
    // Deliberately only re-runs on open/close plus the owner's own identity —
    // not a stable `owner` object across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, owner.kind, owner.id]);

  const restore = async (id: string) => {
    setBusy(id);
    setError(null);
    const key = ownerKey(owner);
    // Same queue key the hook's autosave (and ctx.discard) use for this owner:
    // waits behind any save still on the wire instead of racing it.
    // notifyAdopt — which bumps the owner's generation, invalidating an
    // in-flight save — runs INSIDE this queued write, right after
    // restoreStudioVersion succeeds, so the bump is guaranteed (by the
    // queue's own chaining) to land before the next queued write gets its
    // turn. Mirrors drafts-context.tsx's discard.
    const res = await queueStudioSave(`draft:${key}`, async () => {
      const r = await restoreStudioVersion({ owner, versionId: id });
      if (r.data) notifyAdopt(key, { score: r.data.score, timing: r.data.timing });
      return r;
    });
    setBusy(null);
    if (res.error || !res.data) { setError(res.error ?? 'Could not restore'); return; }
    setStatus(owner, { unpublished: true });
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        className={iconOnly ? 'st-iconbtn' : 'st-chip'}
        title="History"
        aria-label={iconOnly ? 'History' : undefined}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <History className="h-4 w-4" />
        {!iconOnly && <span className="hidden lg:inline">History</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="History" className="st-publish-pop">
          <p className="st-sec-label">History</p>
          {error && <p className="text-xs text-destructive">{error}</p>}
          {!rows && !error && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          {rows && rows.length === 0 && <p className="text-xs text-muted-foreground">No versions yet.</p>}
          {rows && (
            <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
              {rows.map((r) => (
                <li key={r.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted/50">
                  <span className="rounded bg-muted px-1.5 py-px text-[10px] font-semibold uppercase">{r.kind === 'published' ? 'Published' : 'Draft'}</span>
                  {r.isLive && <span className="rounded bg-primary/15 px-1.5 py-px text-[10px] font-semibold uppercase text-primary">Live</span>}
                  <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{new Date(r.updatedAt).toLocaleString()}</span>
                  <button type="button" className="st-chip" disabled={busy != null} onClick={() => void restore(r.id)}>Restore</button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
