'use client';

// One owner's autosave-to-draft. Replaces the hosts' old persist() that wrote
// the live score directly. Score changes arrive via useEditor's isDirty; timing
// changes via setTiming (SyncPanel). Both are saved together as one draft row.
import { useCallback, useEffect, useRef, useState } from 'react';
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
  flush(): Promise<void>;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  error: string | null;
  pending: boolean;
}

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
  const key = ownerKey(owner);
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

  const save = useCallback(async (saveOpts?: { silent?: boolean }) => {
    const snap = latest.current;
    if (!snap.isDirty && !snap.timingDirty) return;
    if (!saveOpts?.silent) { setSaveState('saving'); setError(null); }
    const res = await queueStudioSave(`draft:${key}`, () =>
      saveStudioDraft({ owner, score: snap.score, timing: snap.timing })
    ).catch(() => ({ error: 'Could not save. Check your connection and retry.' } as { error: string; updatedAt?: string }));
    if (res.error) {
      if (!saveOpts?.silent) { setSaveState('error'); setError(res.error); }
      return;
    }
    setStatus(owner, { unpublished: true, label: snap.label });
    if (saveOpts?.silent) return;
    setSaveState('saved');
    // Only clean what this save covered; later edits keep their dirty flags.
    if (latest.current.score === snap.score) markClean();
    if (timingRef.current === snap.timing) { latest.current.timingDirty = false; setTimingDirty(false); }
  }, [key, owner, markClean, setStatus]);

  // Debounced autosave; a failed save waits for flush() (Save now / publish).
  useEffect(() => {
    if ((!isDirty && !timingDirty) || saveState === 'error' || saveState === 'saving') return;
    const id = setTimeout(() => { void save(); }, DRAFT_AUTOSAVE_MS);
    return () => clearTimeout(id);
  }, [isDirty, timingDirty, score, timing, saveState, save]);

  const pending = isDirty || timingDirty;
  useEffect(() => { setPending(key, pending); }, [setPending, key, pending]);

  const flush = useCallback(async () => {
    setSaveState((s) => (s === 'error' ? 'idle' : s));
    await save();
  }, [save]);

  const adopt = useCallback((c: { score: ScoreDocument; timing: StudioTiming }) => {
    replaceScore(c.score);
    latest.current.isDirty = false;
    replaceTiming(c.timing);
    setSaveState('idle');
    setError(null);
  }, [replaceScore, replaceTiming]);

  useEffect(() => register(key, { flush, adopt }), [register, key, flush, adopt]);

  // Unmount: wait one tick so children's cleanup setTiming calls land first.
  useEffect(() => {
    return () => {
      setPending(key, false);
      setTimeout(() => { void save({ silent: true }); }, 0);
    };
    // `save` intentionally not in deps: it always reads `latest.current`, which
    // is updated synchronously during render (including a child's own unmount
    // cleanup that runs before this one), so any render's `save` closure sees
    // the final values once the deferred tick runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, setPending]);

  useEffect(() => {
    // Keep the popover label fresh without treating a label-only change as an edit.
    setStatus(owner, { label });
  }, [owner, label, setStatus]);

  return { timing, timingEpoch, setTiming, replaceTiming, flush, saveState, error, pending };
}
