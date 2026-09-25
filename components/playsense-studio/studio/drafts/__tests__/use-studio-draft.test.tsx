// @vitest-environment jsdom
import React, { act, useCallback, useEffect, useLayoutEffect, useReducer } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const acts = vi.hoisted(() => ({ saveStudioDraft: vi.fn(), publishStudioDraft: vi.fn(), discardStudioDraft: vi.fn() }));
vi.mock('@/app/actions/studio-drafts', () => acts);

import { EMPTY_TIMING } from '@/lib/playsense-studio/drafts/timing';
import { StudioDraftsProvider, useStudioDrafts, type StudioDraftsValue } from '../drafts-context';
import { useStudioDraft, type StudioDraftApi } from '../use-studio-draft';

type S = { title: string };
const owner = { kind: 'section' as const, id: 'sec-1' };
let root: Root;
let host: HTMLDivElement;
let api: StudioDraftApi;
let ctx: StudioDraftsValue;
let edit: (title: string) => void;

function Editor({ onUnmountTiming }: { onUnmountTiming?: boolean }) {
  const [state, dispatch] = useReducer(
    (s: { score: S; isDirty: boolean }, a: { type: 'edit'; title: string } | { type: 'clean' } | { type: 'replace'; score: S }) =>
      a.type === 'edit' ? { score: { title: a.title }, isDirty: true } : a.type === 'clean' ? { ...s, isDirty: false } : { score: a.score, isDirty: false },
    { score: { title: 'A' }, isDirty: false }
  );
  useLayoutEffect(() => { edit = (title: string) => dispatch({ type: 'edit', title }); }, [dispatch]);
  const draftApi = useStudioDraft({
    owner, label: 'Intro', score: state.score as never, isDirty: state.isDirty,
    markClean: () => dispatch({ type: 'clean' }), replaceScore: (s) => dispatch({ type: 'replace', score: s as never }),
    initialTiming: EMPTY_TIMING,
  });
  useLayoutEffect(() => { api = draftApi; }, [draftApi]);
  return <>{onUnmountTiming && <TimingChild setTiming={draftApi.setTiming} />}</>;
}
function TimingChild({ setTiming }: { setTiming: StudioDraftApi['setTiming'] }) {
  useEffect(() => () => setTiming({ params: { final: true } }), [setTiming]);
  return null;
}
function Probe() {
  const value = useStudioDrafts();
  useLayoutEffect(() => { ctx = value; }, [value]);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  acts.saveStudioDraft.mockResolvedValue({ updatedAt: '2026-09-25T10:00:00.000Z' });
  acts.publishStudioDraft.mockResolvedValue({ publishedAt: '2026-09-25T10:00:01.000Z' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.useRealTimers();
});

const mount = (children: React.ReactNode) =>
  act(() => root.render(<StudioDraftsProvider owners={[{ owner, label: 'Intro', unpublished: false }]}><Probe />{children}</StudioDraftsProvider>));

describe('useStudioDraft', () => {
  it('saves a draft 1 s after the last edit and marks the owner unpublished', async () => {
    mount(<Editor />);
    act(() => edit('B'));
    await act(async () => { vi.advanceTimersByTime(999); });
    expect(acts.saveStudioDraft).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(acts.saveStudioDraft).toHaveBeenCalledWith({ owner, score: { title: 'B' }, timing: EMPTY_TIMING });
    expect(ctx.statuses['section:sec-1'].unpublished).toBe(true);
    expect(api.saveState).toBe('saved');
  });
  it('saves timing changes even when the score is clean', async () => {
    mount(<Editor />);
    act(() => api.setTiming({ anchor: { seconds: 2, qn: 1 } }));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(acts.saveStudioDraft).toHaveBeenCalledWith(expect.objectContaining({ timing: { ...EMPTY_TIMING, anchor: { seconds: 2, qn: 1 } } }));
  });
  it('publish flushes a pending edit first, so the last edit is published', async () => {
    mount(<Editor />);
    act(() => edit('Last'));
    await act(async () => { await ctx.publish(owner); });
    expect(acts.saveStudioDraft).toHaveBeenCalledWith(expect.objectContaining({ score: { title: 'Last' } }));
    expect(acts.saveStudioDraft.mock.invocationCallOrder[0]).toBeLessThan(acts.publishStudioDraft.mock.invocationCallOrder[0]);
    expect(ctx.statuses['section:sec-1'].unpublished).toBe(false);
  });
  it('the unmount flush waits a tick so a child\'s final setTiming lands', async () => {
    mount(<Editor onUnmountTiming />);
    act(() => edit('B'));
    act(() => root.render(<StudioDraftsProvider owners={[]}><Probe /></StudioDraftsProvider>));
    await act(async () => { vi.advanceTimersByTime(0); });
    expect(acts.saveStudioDraft).toHaveBeenCalledTimes(1);
    expect(acts.saveStudioDraft).toHaveBeenCalledWith(expect.objectContaining({ score: { title: 'B' }, timing: expect.objectContaining({ params: { final: true } }) }));
  });
  it('discard adopts the live content into the editor and bumps the timing epoch', async () => {
    acts.discardStudioDraft.mockResolvedValue({ data: { score: { title: 'Live' }, timing: EMPTY_TIMING, updatedAt: '' } });
    mount(<Editor />);
    const epoch = api.timingEpoch;
    await act(async () => { await ctx.discard(owner); });
    expect(api.timingEpoch).toBe(epoch + 1);
    expect(acts.saveStudioDraft).not.toHaveBeenCalled();
  });
  it('shows an error and stops retrying when the save fails', async () => {
    acts.saveStudioDraft.mockResolvedValue({ error: 'Admin only' });
    mount(<Editor />);
    act(() => edit('B'));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(api.saveState).toBe('error');
    expect(api.error).toBe('Admin only');
    await act(async () => { vi.advanceTimersByTime(5000); });
    expect(acts.saveStudioDraft).toHaveBeenCalledTimes(1);
  });
});

// ---- Fix round 1: the draft data can never be wrong -------------------------

describe('useStudioDraft — fix round 1: draft safety', () => {
  it('publish stops and returns the error when the flush fails, without calling publishStudioDraft', async () => {
    acts.saveStudioDraft.mockResolvedValue({ error: 'Admin only' });
    mount(<Editor />);
    act(() => edit('B'));
    let result: { error?: string } | undefined;
    await act(async () => { result = await ctx.publish(owner); });
    expect(result).toEqual({ error: 'Admin only' });
    expect(acts.publishStudioDraft).not.toHaveBeenCalled();
    expect(ctx.statuses['section:sec-1'].unpublished).toBe(false);
  });

  it('discard pressed while a save is in flight runs after the save resolves, and ends unpublished:false', async () => {
    let resolveSave!: (v: { updatedAt: string }) => void;
    acts.saveStudioDraft.mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));
    acts.discardStudioDraft.mockResolvedValue({ data: { score: { title: 'Live' }, timing: EMPTY_TIMING, updatedAt: '' } });
    mount(<Editor />);
    act(() => edit('B'));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(acts.saveStudioDraft).toHaveBeenCalledTimes(1);
    expect(acts.discardStudioDraft).not.toHaveBeenCalled();

    let discardPromise!: Promise<{ error?: string }>;
    act(() => { discardPromise = ctx.discard(owner); });
    // Still queued behind the in-flight save — the actual discard call hasn't fired.
    expect(acts.discardStudioDraft).not.toHaveBeenCalled();

    let discardResult: { error?: string } | undefined;
    await act(async () => {
      resolveSave({ updatedAt: '2026-09-25T10:00:02.000Z' });
      discardResult = await discardPromise;
    });
    expect(acts.discardStudioDraft).toHaveBeenCalledTimes(1);
    expect(discardResult).toEqual({});
    expect(ctx.statuses['section:sec-1'].unpublished).toBe(false);
  });

  it("a save that started before an adopt doesn't flip the status back to unpublished", async () => {
    let resolveSave!: (v: { updatedAt: string }) => void;
    acts.saveStudioDraft.mockImplementation(() => new Promise((resolve) => { resolveSave = resolve; }));
    mount(<Editor />);
    act(() => edit('B'));
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(acts.saveStudioDraft).toHaveBeenCalledTimes(1);

    // A direct restore-style adopt (bypassing publish/discard's queue) while
    // that save is still in flight, and whatever drove it marks the owner
    // published.
    act(() => {
      ctx.notifyAdopt('section:sec-1', { score: { title: 'Restored' } as never, timing: EMPTY_TIMING });
      ctx.setStatus(owner, { unpublished: false });
    });
    expect(ctx.statuses['section:sec-1'].unpublished).toBe(false);

    await act(async () => { resolveSave({ updatedAt: '2026-09-25T10:00:02.000Z' }); });
    // The stale save must not resurrect the unpublished flag.
    expect(ctx.statuses['section:sec-1'].unpublished).toBe(false);
  });

  it('logs a dev warning when the owner key changes without a remount', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    function Wrapper({ id }: { id: string }) {
      useStudioDraft({
        owner: { kind: 'section', id }, label: 'Intro', score: { title: 'A' } as never, isDirty: false,
        markClean: () => {}, replaceScore: () => {}, initialTiming: EMPTY_TIMING,
      });
      return null;
    }
    act(() => root.render(
      <StudioDraftsProvider owners={[{ owner, label: 'Intro', unpublished: false }]}><Probe /><Wrapper id="sec-1" /></StudioDraftsProvider>
    ));
    expect(spy).not.toHaveBeenCalled();
    // Same component instance (no key change on Wrapper itself), different owner id:
    // this must never happen from a well-behaved host, but the hook should say so.
    act(() => root.render(
      <StudioDraftsProvider owners={[{ owner, label: 'Intro', unpublished: false }]}><Probe /><Wrapper id="sec-2" /></StudioDraftsProvider>
    ));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0][0])).toContain('useStudioDraft');
    spy.mockRestore();
  });

  it('a new but equal owner object does not restart the debounce', async () => {
    function StableEditor({ ownerObj }: { ownerObj: typeof owner }) {
      const [state, dispatch] = useReducer(
        (s: { score: S; isDirty: boolean }, a: { type: 'edit'; title: string } | { type: 'clean' }) =>
          a.type === 'edit' ? { score: { title: a.title }, isDirty: true } : { ...s, isDirty: false },
        { score: { title: 'A' }, isDirty: false }
      );
      useLayoutEffect(() => { edit = (title: string) => dispatch({ type: 'edit', title }); }, [dispatch]);
      const markClean = useCallback(() => dispatch({ type: 'clean' }), []);
      const replaceScore = useCallback(() => {}, []);
      useStudioDraft({
        owner: ownerObj, label: 'Intro', score: state.score as never, isDirty: state.isDirty,
        markClean, replaceScore, initialTiming: EMPTY_TIMING,
      });
      return null;
    }
    const render = () => act(() => root.render(
      <StudioDraftsProvider owners={[{ owner, label: 'Intro', unpublished: false }]}>
        <Probe /><StableEditor ownerObj={{ kind: 'section', id: 'sec-1' }} />
      </StudioDraftsProvider>
    ));
    render();
    act(() => edit('B'));
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(acts.saveStudioDraft).not.toHaveBeenCalled();
    // Re-render with a brand-new owner object carrying the same kind/id — the
    // debounce timer set 500ms ago must survive this, not restart.
    render();
    await act(async () => { vi.advanceTimersByTime(500); });
    expect(acts.saveStudioDraft).toHaveBeenCalledTimes(1);
  });
});

// ---- Fix round 2: a save queued behind a discard must not send stale content --

describe('useStudioDraft — fix round 2: a queued save cannot resurrect a discard', () => {
  it('a debounced save queued behind an in-flight discard never sends the pre-discard content', async () => {
    let resolveDiscard!: (v: unknown) => void;
    acts.discardStudioDraft.mockImplementation(() => new Promise((resolve) => { resolveDiscard = resolve; }));
    mount(<Editor />);
    act(() => edit('B'));

    let discardPromise!: Promise<{ error?: string }>;
    act(() => { discardPromise = ctx.discard(owner); });

    // The debounce fires while the discard is still in flight: the resulting
    // save queues behind it instead of running immediately.
    await act(async () => { vi.advanceTimersByTime(1000); });
    expect(acts.saveStudioDraft).not.toHaveBeenCalled();

    await act(async () => {
      resolveDiscard({ data: { score: { title: 'Live' }, timing: EMPTY_TIMING, updatedAt: '' } });
      await discardPromise;
      // Let the now-stale, queued save's turn come up and finish.
      for (let i = 0; i < 10; i++) await Promise.resolve();
    });

    expect(acts.saveStudioDraft).not.toHaveBeenCalledWith(expect.objectContaining({ score: { title: 'B' } }));
    expect(ctx.statuses['section:sec-1'].unpublished).toBe(false);
  });
});
