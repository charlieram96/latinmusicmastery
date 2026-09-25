'use client';

// Lesson-wide draft state: which owners (sections, the exercise score, a song)
// have unpublished drafts, plus publish/discard and the leave-page warning.
// The OUTERMOST provider owns the state; nested providers (the workspaces inside
// ExerciseStudio) only seed their owners into it and reuse its value.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { discardStudioDraft, publishStudioDraft } from '@/app/actions/studio-drafts';
import { queueStudioSave } from '@/lib/playsense-studio/save-queue';
import type { StudioContent } from '@/lib/playsense-studio/drafts/changes';
import { ownerKey, type StudioDraftOwner } from '@/lib/playsense-studio/drafts/types';

export interface OwnerStatus {
  owner: StudioDraftOwner;
  label: string;
  unpublished: boolean;
}

export interface OwnerHandlers {
  /** Resolves any error from the pending autosave; publish refuses to run past one. */
  flush?: () => Promise<{ error?: string } | void>;
  adopt?: (c: StudioContent) => void;
  changed?: () => void;
}

export interface StudioDraftsValue {
  statuses: Record<string, OwnerStatus>;
  setStatus(owner: StudioDraftOwner, patch: { label?: string; unpublished?: boolean }): void;
  setPending(key: string, pending: boolean): void;
  register(key: string, handlers: OwnerHandlers): () => void;
  flush(key: string): Promise<{ error?: string }>;
  publish(owner: StudioDraftOwner): Promise<{ error?: string }>;
  discard(owner: StudioDraftOwner): Promise<{ error?: string }>;
  notifyAdopt(key: string, content: StudioContent): void;
}

const Ctx = createContext<StudioDraftsValue | null>(null);

export function useStudioDrafts(): StudioDraftsValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useStudioDrafts must be used inside StudioDraftsProvider');
  return v;
}

export function StudioDraftsProvider({ owners, children }: { owners: OwnerStatus[]; children: React.ReactNode }) {
  const parent = useContext(Ctx);
  if (parent) return <NestedSeed parent={parent} owners={owners}>{children}</NestedSeed>;
  return <RootProvider owners={owners}>{children}</RootProvider>;
}

function NestedSeed({ parent, owners, children }: { parent: StudioDraftsValue; owners: OwnerStatus[]; children: React.ReactNode }) {
  // Seed once per owner set; statuses already known to the root win.
  const seedKey = owners.map((o) => ownerKey(o.owner)).join('|');
  const setStatus = parent.setStatus;
  useEffect(() => {
    for (const o of owners) {
      if (!parent.statuses[ownerKey(o.owner)]) setStatus(o.owner, { label: o.label, unpublished: o.unpublished });
    }
    // Runs once per distinct owner set; `owners` is re-derived every render by
    // the caller, so it can't be a stable dependency itself.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedKey, setStatus]);
  return <Ctx.Provider value={parent}>{children}</Ctx.Provider>;
}

function RootProvider({ owners, children }: { owners: OwnerStatus[]; children: React.ReactNode }) {
  const [statuses, setStatuses] = useState<Record<string, OwnerStatus>>(() =>
    Object.fromEntries(owners.map((o) => [ownerKey(o.owner), o]))
  );
  const [pending, setPendingMap] = useState<Record<string, boolean>>({});
  const handlers = useRef(new Map<string, Set<OwnerHandlers>>());

  const setStatus = useCallback((owner: StudioDraftOwner, patch: { label?: string; unpublished?: boolean }) => {
    setStatuses((prev) => {
      const key = ownerKey(owner);
      const cur = prev[key] ?? { owner, label: '', unpublished: false };
      const next = { ...cur, ...patch };
      if (cur.label === next.label && cur.unpublished === next.unpublished && prev[key]) return prev;
      return { ...prev, [key]: next };
    });
  }, []);

  const setPending = useCallback((key: string, p: boolean) => {
    setPendingMap((prev) => (!!prev[key] === p ? prev : { ...prev, [key]: p }));
  }, []);

  const register = useCallback((key: string, h: OwnerHandlers) => {
    let set = handlers.current.get(key);
    if (!set) handlers.current.set(key, (set = new Set()));
    set.add(h);
    return () => { set!.delete(h); };
  }, []);

  const each = (key: string) => [...(handlers.current.get(key) ?? [])];

  const flush = useCallback(async (key: string): Promise<{ error?: string }> => {
    const results = await Promise.all(each(key).map((h) => h.flush?.()));
    const failed = results.find((r): r is { error: string } => !!r && !!r.error);
    return failed ? { error: failed.error } : {};
  }, []);

  const notifyAdopt = useCallback((key: string, content: StudioContent) => {
    each(key).forEach((h) => h.adopt?.(content));
  }, []);

  const publish = useCallback(async (owner: StudioDraftOwner) => {
    const key = ownerKey(owner);
    const flushed = await flush(key);
    if (flushed.error) return { error: flushed.error };
    // Same queue key the hook's autosave uses: waits for any save still on
    // the wire (flush() only waited for the LAST one it kicked off) instead
    // of racing it.
    const res = await queueStudioSave(`draft:${key}`, () => publishStudioDraft(owner));
    if (res.error) return { error: res.error };
    setStatus(owner, { unpublished: false });
    each(key).forEach((h) => h.changed?.());
    return {};
  }, [flush, setStatus]);

  const discard = useCallback(async (owner: StudioDraftOwner) => {
    const key = ownerKey(owner);
    // Same reasoning as publish: wait behind any in-flight save on this owner
    // instead of racing it. notifyAdopt (which bumps the owner's generation,
    // invalidating an in-flight save) runs INSIDE this queued write, right
    // after discardStudioDraft succeeds — not after this whole call resolves
    // — so the bump is guaranteed, by the queue's own chaining, to happen
    // before the next queued write (e.g. a debounced save that queued behind
    // this discard) gets its turn. Relying on that write to notice the bump
    // only afterward would be too late: it would already have sent the
    // pre-discard content to the server as a new draft row.
    const res = await queueStudioSave(`draft:${key}`, async () => {
      const r = await discardStudioDraft(owner);
      if (r.data) notifyAdopt(key, { score: r.data.score, timing: r.data.timing });
      return r;
    });
    if (res.error) return { error: res.error };
    setStatus(owner, { unpublished: false });
    each(key).forEach((h) => h.changed?.());
    return {};
  }, [notifyAdopt, setStatus]);

  // Leaving with unsaved or unpublished work asks the browser to confirm. The
  // listener is only attached while something is actually blocking, so it
  // never has to read stale state.
  const blocked = Object.values(pending).some(Boolean) || Object.values(statuses).some((s) => s.unpublished);
  useEffect(() => {
    if (!blocked) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [blocked]);

  const value = useMemo<StudioDraftsValue>(
    () => ({ statuses, setStatus, setPending, register, flush, publish, discard, notifyAdopt }),
    [statuses, setStatus, setPending, register, flush, publish, discard, notifyAdopt]
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
