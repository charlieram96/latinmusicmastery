// @vitest-environment jsdom
import React, { act, useEffect, useLayoutEffect, useReducer } from 'react';
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
