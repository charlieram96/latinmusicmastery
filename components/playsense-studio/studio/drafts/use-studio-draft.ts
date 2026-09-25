'use client';

// One owner's autosave-to-draft. Replaces the hosts' old persist() that wrote
// the live score directly. Score changes arrive via useEditor's isDirty; timing
// changes via setTiming (SyncPanel). Both are saved together as one draft row.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { saveStudioDraft } from '@/app/actions/studio-drafts';
import { queueStudioSave } from '@/lib/playsense-studio/save-queue';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import type { StudioTiming } from '@/lib/playsense-studio/drafts/timing';
import { ownerKey, type StudioDraftOwner } from '@/lib/playsense-studio/drafts/types';
import { useStudioDrafts } from './drafts-context';

export const DRAFT_AUTOSAVE_MS = 1000;

export interface StudioDraftApi {
  timing: StudioTiming;
  /** Bumps when timing is replaced wholesale (restore/discard); key SyncPanel on it. */
  timingEpoch: number;
  setTiming(patch: Partial<StudioTiming>): void;
  replaceTiming(t: StudioTiming): void;
  flush(): Promise<{ error?: string }>;
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
}): StudioDraftApi {
  const { owner, label, score, isDirty, markClean, replaceScore } = opts;
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

  // Latest values for timers and the unmount flush.
  const latest = useRef({ score, isDirty, timing, timingDirty, label });
  latest.current = { score, isDirty, timing, timingDirty, label };
  const timingRef = useRef(timing);

  // Invalidates an in-flight save: bumped whenever fresh content is adopted
  // (discard/restore) so a save already on the wire when that happens can't
  // clobber it once it finally resolves.
  const generationRef = useRef(0);

  const setTiming = useCallback((patch: Partial<StudioTiming>) => {
    const next = { ...timingRef.current, ...patch };
    timingRef.current = next;
    latest.current.timing = next;
    latest.current.timingDirty = true;
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

  const { setStatus, setPending, register } = ctx;

  const save = useCallback(async (saveOpts?: { silent?: boolean }): Promise<{ error?: string }> => {
    const snap = latest.current;
    if (!snap.isDirty && !snap.timingDirty) return {};
    const myGeneration = generationRef.current;
    if (!saveOpts?.silent) { setSaveState('saving'); setError(null); }
    const res = await queueStudioSave(`draft:${key}`, () =>
      saveStudioDraft({ owner: memoOwner, score: snap.score, timing: snap.timing })
    ).catch(() => ({ error: 'Could not save. Check your connection and retry.' } as { error: string; updatedAt?: string }));
    // Content was replaced (discard/restore) while this save was on the
    // wire: its result no longer describes the current draft, so it must not
    // touch saveState, the unpublished flag, or the dirty flags.
    if (generationRef.current !== myGeneration) return res.error ? { error: res.error } : {};
    if (res.error) {
      if (!saveOpts?.silent) { setSaveState('error'); setError(res.error); }
      return { error: res.error };
    }
    setStatus(memoOwner, { unpublished: true, label: snap.label });
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
    return () => {
      setPending(key, false);
      setTimeout(() => { void save({ silent: true }); }, 0);
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

  return { timing, timingEpoch, setTiming, replaceTiming, flush, saveState, error, pending };
}
