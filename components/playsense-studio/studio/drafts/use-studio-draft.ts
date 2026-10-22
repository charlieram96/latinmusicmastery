'use client';

// One owner's autosave-to-draft. Replaces the hosts' old persist() that wrote
// the live score directly. Score changes arrive via useEditor's isDirty; timing
// changes via setTiming (SyncPanel). Both are saved together as one draft row.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { historyReducer, type HistoryState } from '@/hooks/use-history';
import { saveStudioDraft } from '@/app/actions/studio-drafts';
import { queueStudioSave } from '@/lib/playsense-studio/save-queue';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import type { StudioTiming } from '@/lib/playsense-studio/drafts/timing';
import { ownerKey, type StudioDraftOwner } from '@/lib/playsense-studio/drafts/types';
import { useStudioDrafts } from './drafts-context';

type EditSnapshot = {score: ScoreDocument; timing: StudioTiming};
// Navigation between Studio documents must not silently discard undo. A stale
// cache is never applied over content changed by another editor/session.
const documentHistories = new Map<string, HistoryState<EditSnapshot>>();

export const DRAFT_AUTOSAVE_MS = 1000;

export interface StudioDraftApi {
  timing: StudioTiming;
  checkpoint(): void;
  undo(): void;
  redo(): void;
  canUndo: boolean;
  canRedo: boolean;
  /** Bumps when timing is replaced wholesale (restore/discard); key SyncPanel on it. */
  timingEpoch: number;
  setTiming(patch: Partial<StudioTiming>): void;
  replaceTiming(t: StudioTiming): void;
  flush(): Promise<{ error?: string }>;
  /** Registers a fn that `flush()` runs synchronously, before it snapshots and
   *  saves — e.g. so a child (SyncPanel) can fold in a still-debounced drag or
   *  anchor edit right before a Publish. Returns an unregister fn. */
  registerPreFlush(fn: () => void): () => void;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  error: string | null;
  pending: boolean;
}

/**
 * Autosaves one owner's score + timing to a draft row.
 *
 * Hosts must remount this hook per owner: key the component that calls it by
 * `ownerKey(owner)` (e.g. `<Workspace key={ownerKey(owner)} .../>`). The hook
 * treats `owner` as fixed for its whole life — the debounce timers and the
 * unmount flush below close over it once, at mount, and never re-read it. In
 * development, changing `owner.kind`/`owner.id` without remounting logs a
 * console.error instead of silently saving under the wrong key.
 */
export function useStudioDraft(opts: {
  owner: StudioDraftOwner;
  label: string;
  score: ScoreDocument;
  isDirty: boolean;
  markClean: () => void;
  replaceScore: (s: ScoreDocument) => void;
  initialTiming: StudioTiming;
  /** Notified with whatever content was just sent to (or was about to be sent
   *  to, at unmount) the draft — lets a host cache it locally, e.g. so a
   *  section reopened later seeds from it without waiting for a refetch. */
  onDraftContent?: (c: { score: ScoreDocument; timing: StudioTiming }) => void;
}): StudioDraftApi {
  const { owner, label, score, isDirty, markClean, replaceScore } = opts;
  // Kept in a ref, not a `save`/effect dependency: a host typically passes a
  // fresh closure every render, and we only ever need the latest one at call
  // time, not to react to it changing.
  const onDraftContentRef = useRef(opts.onDraftContent);
  useEffect(() => {
    onDraftContentRef.current = opts.onDraftContent;
  });
  // Stable across renders as long as kind/id don't change, even if the host
  // passes a fresh `{ kind, id }` literal every render — an inline owner
  // object must never restart the debounce timer below. Used everywhere
  // instead of the raw `owner` prop.
  const memoOwner = useMemo<StudioDraftOwner>(() => ({ kind: owner.kind, id: owner.id }), [owner.kind, owner.id]);
  const key = ownerKey(memoOwner);
  const ctx = useStudioDrafts();

  const [timing, setTimingState] = useState(opts.initialTiming);
  const [timingEpoch, setTimingEpoch] = useState(0);
  const [timingDirty, setTimingDirty] = useState(false);
  const [saveState, setSaveState] = useState<StudioDraftApi['saveState']>('idle');
  const [error, setError] = useState<string | null>(null);

  // Latest values for timers and the unmount flush. Written from a layout
  // effect (never during render — a ref write during render is disallowed
  // and can run more than once without committing under Strict Mode);
  // `setTiming`/`replaceTiming` below still write it directly, since those
  // only ever run from an event handler or a cleanup, never during render.
  const latest = useRef({ score, isDirty, timing, timingDirty, label });
  useLayoutEffect(() => {
    latest.current = { score, isDirty, timing, timingDirty, label };
  });
  const timingRef = useRef(timing);

  // Invalidates an in-flight save: bumped whenever fresh content is adopted
  // (discard/restore) so a save already on the wire when that happens can't
  // clobber it once it finally resolves.
  const generationRef = useRef(0);

  // Fns registered by a child (e.g. SyncPanel) to run right before a flush
  // snapshots and saves — see registerPreFlush below.
  const preFlushFns = useRef(new Set<() => void>());
  const registerPreFlush = useCallback((fn: () => void) => {
    preFlushFns.current.add(fn);
    return () => { preFlushFns.current.delete(fn); };
  }, []);

  const setTiming = useCallback((patch: Partial<StudioTiming>) => {
    const next = { ...timingRef.current, ...patch };
    timingRef.current = next;
    latest.current.timing = next;
    latest.current.timingDirty = true;
    onDraftContentRef.current?.({ score: latest.current.score, timing: next });
    setTimingState(next);
    setTimingDirty(true);
  }, []);

  const replaceTiming = useCallback((t: StudioTiming) => {
    timingRef.current = t;
    latest.current.timing = t;
    latest.current.timingDirty = false;
    setTimingState(t);
    setTimingDirty(false);
    setTimingEpoch((e) => e + 1);
  }, []);

  const [seedHistory] = useState(() => {
    const present={score,timing:opts.initialTiming};
    const saved=documentHistories.get(key);
    return saved && JSON.stringify(saved.present)===JSON.stringify(present) ? saved : {past:[],present,future:[]};
  });
  const historyRef = useRef<HistoryState<EditSnapshot>>(seedHistory);
  const rememberHistory = useCallback(() => {
    documentHistories.delete(key);
    documentHistories.set(key,historyRef.current);
    if(documentHistories.size>30)documentHistories.delete(documentHistories.keys().next().value!);
  },[key]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const recordSnapshot = useCallback(() => {
    const next = historyReducer(historyRef.current, {type:'commit', next:{score:latest.current.score,timing:timingRef.current}});
    if (next !== historyRef.current) {historyRef.current=next;rememberHistory();setHistoryVersion(v=>v+1);}
  }, [rememberHistory]);
  // A React commit is one editing transaction: score and sync changes made by
  // the same action share a snapshot rather than competing undo stacks.
  useLayoutEffect(recordSnapshot, [score, timing, recordSnapshot]);
  const checkpoint=useCallback(()=>{preFlushFns.current.forEach(fn=>fn());recordSnapshot();},[recordSnapshot]);
  const travel = useCallback((type:'undo'|'redo') => {
    // Finish a pending drag before stepping back, otherwise it can arrive late
    // and overwrite the restored timing or appear to undo an unrelated note.
    preFlushFns.current.forEach(fn=>fn());
    recordSnapshot();
    const next=historyReducer(historyRef.current,{type});
    if(next===historyRef.current)return;
    historyRef.current=next;
    rememberHistory();
    generationRef.current+=1;
    latest.current.score=next.present.score;
    replaceScore(next.present.score);
    replaceTiming(next.present.timing);
    latest.current.timingDirty=true;
    setTimingDirty(true);
    setSaveState('idle');setError(null);
    setHistoryVersion(v=>v+1);
  },[recordSnapshot,replaceScore,replaceTiming,rememberHistory]);
  const undo=useCallback(()=>travel('undo'),[travel]);
  const redo=useCallback(()=>travel('redo'),[travel]);
  void historyVersion;

  const { setStatus, setPending, register } = ctx;

  const save = useCallback(async (saveOpts?: { silent?: boolean }): Promise<{ error?: string }> => {
    const snap = latest.current;
    if (!snap.isDirty && !snap.timingDirty) return {};
    const myGeneration = generationRef.current;
    if (!saveOpts?.silent) { setSaveState('saving'); setError(null); }
    const res = await queueStudioSave(`draft:${key}`, () => {
      // This save may have queued behind another write on the same owner
      // (e.g. a discard) that replaced the content before this one's turn
      // came up. Re-check right here, at send time — not just when save()
      // was first called — because sending stale content now would
      // resurrect it as a new draft row once it reaches the server.
      if (generationRef.current !== myGeneration) return Promise.resolve<{ error?: string; updatedAt?: string }>({});
      return saveStudioDraft({ owner: memoOwner, score: snap.score, timing: snap.timing });
    }).catch(() => ({ error: 'Could not save. Check your connection and retry.' } as { error: string; updatedAt?: string }));
    // Stale either at send time (caught above) or by the time this round
    // trip finished: either way, don't touch saveState, the unpublished
    // flag, or the dirty flags — the result no longer describes the
    // current draft.
    if (generationRef.current !== myGeneration) return res.error ? { error: res.error } : {};
    if (res.error) {
      if (!saveOpts?.silent) { setSaveState('error'); setError(res.error); }
      return { error: res.error };
    }
    setStatus(memoOwner, { unpublished: true, label: snap.label });
    if (latest.current.score === snap.score && timingRef.current === snap.timing) {
      onDraftContentRef.current?.({ score: snap.score, timing: snap.timing });
    }
    if (saveOpts?.silent) return {};
    setSaveState('saved');
    // Only clean what this save covered; later edits keep their dirty flags.
    if (latest.current.score === snap.score) markClean();
    if (timingRef.current === snap.timing) { latest.current.timingDirty = false; setTimingDirty(false); }
    return {};
  }, [key, memoOwner, markClean, setStatus]);

  // Debounced autosave; a failed save waits for flush() (Save now / publish).
  useEffect(() => {
    if ((!isDirty && !timingDirty) || saveState === 'error' || saveState === 'saving') return;
    const id = setTimeout(() => { void save(); }, DRAFT_AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [isDirty, timingDirty, score, timing, saveState, save]);

  const pending = isDirty || timingDirty;
  useEffect(() => { setPending(key, pending); }, [setPending, key, pending]);

  const flush = useCallback(async (): Promise<{ error?: string }> => {
    // Synchronous, before the snapshot: a pre-flush fn (e.g. SyncPanel's) calls
    // setTiming directly, which writes latest.current itself (not just state),
    // so save() below reads the fresh value even though it hasn't re-rendered.
    preFlushFns.current.forEach((fn) => fn());
    setSaveState((s) => (s === 'error' ? 'idle' : s));
    return save();
  }, [save]);

  const adopt = useCallback((c: { score: ScoreDocument; timing: StudioTiming }) => {
    generationRef.current += 1;
    replaceScore(c.score);
    latest.current.isDirty = false;
    replaceTiming(c.timing);
    setSaveState('idle');
    setError(null);
  }, [replaceScore, replaceTiming]);

  useEffect(() => register(key, { flush, adopt }), [register, key, flush, adopt]);

  // Mount-only: this must fire exactly once, at unmount — not whenever `key`
  // or `setPending` happen to change (see the file's "hosts must remount per
  // owner" contract above) — so `owner`/`key` are captured once here, from
  // mount, deliberately not re-read on every render.
  //
  // React removes an unmounting subtree parent-first: this cleanup runs
  // *before* a descendant's (e.g. a SyncPanel child's own cleanup, which can
  // call setTiming one last time). `latest`/`timingRef` are the same ref
  // objects that child mutates directly, so deferring the actual read by a
  // tick — past the whole synchronous unmount pass, this component's cleanup
  // and every descendant's — picks up its write too. `save` reads `latest`
  // at call time, not at effect-setup time, so it doesn't matter that this
  // effect's own closure over it is fixed from mount.
  useEffect(() => {
    // Same Set object for the component's whole life (only ever mutated via
    // add/delete, never reassigned), so capturing it here rather than reading
    // `preFlushFns.current` from inside the timeout below is equivalent — and
    // keeps the linter from mistaking it for a DOM-node ref.
    const fns = preFlushFns.current;
    return () => {
      setPending(key, false);
      setTimeout(() => {
        // Read AFTER the deferred tick (see above) so a descendant's own
        // cleanup-time write (e.g. SyncPanel's last setTiming) is already in
        // `latest`. Run any registered pre-flush fns first — same reasoning:
        // SyncPanel's own registered fn flushes its debounced drag/anchor
        // timers here too. Notify the host with this final snapshot itself —
        // before the silent save below even starts — so it doesn't have to
        // wait on that round trip to have the section's truest last-known
        // content.
        fns.forEach((fn) => fn());
        const snap = latest.current;
        if (snap.isDirty || snap.timingDirty) {
          onDraftContentRef.current?.({ score: snap.score, timing: snap.timing });
        }
        void save({ silent: true });
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dev-only: catch a host that violates the "stable owner" contract above
  // instead of silently saving the new owner's edits under the old key (or
  // vice versa).
  const mountKeyRef = useRef(key);
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production' && key !== mountKeyRef.current) {
      console.error(
        `useStudioDraft: owner changed from "${mountKeyRef.current}" to "${key}" without remounting. ` +
        'Host components must key by ownerKey(owner).'
      );
    }
  }, [key]);

  useEffect(() => {
    // Keep the popover label fresh without treating a label-only change as an edit.
    setStatus(memoOwner, { label });
  }, [memoOwner, label, setStatus]);

  return { timing, timingEpoch, setTiming, replaceTiming, flush, registerPreFlush, saveState, error, pending, checkpoint, undo, redo, canUndo:historyRef.current.past.length>0, canRedo:historyRef.current.future.length>0 };
}
