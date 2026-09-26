// @vitest-environment jsdom
import React, { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/app/actions/studio-drafts', () => ({ saveStudioDraft: vi.fn(), publishStudioDraft: vi.fn(), discardStudioDraft: vi.fn() }));
import { discardStudioDraft } from '@/app/actions/studio-drafts';
import { EMPTY_TIMING } from '@/lib/playsense-studio/drafts/timing';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { StudioDraftsProvider, useStudioDrafts, type StudioDraftsValue } from '../drafts-context';

let root: Root;
let host: HTMLDivElement;
let outer: StudioDraftsValue;
let inner: StudioDraftsValue;
function Outer() {
  const value = useStudioDrafts();
  useLayoutEffect(() => { outer = value; }, [value]);
  return null;
}
function Inner() {
  const value = useStudioDrafts();
  useLayoutEffect(() => { inner = value; }, [value]);
  return null;
}

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('StudioDraftsProvider', () => {
  it('a nested provider shares the root value and seeds its owners into it', () => {
    act(() => root.render(
      <StudioDraftsProvider owners={[{ owner: { kind: 'exercise', id: 'ci-1' }, label: 'Exercise', unpublished: false }]}>
        <Outer />
        <StudioDraftsProvider owners={[{ owner: { kind: 'section', id: 's1' }, label: 'Intro', unpublished: true }]}>
          <Inner />
        </StudioDraftsProvider>
      </StudioDraftsProvider>
    ));
    expect(Object.keys(outer.statuses).sort()).toEqual(['exercise:ci-1', 'section:s1']);
    expect(inner.statuses).toBe(outer.statuses);
  });
  it('warns before unload while anything is unpublished or unsaved', () => {
    act(() => root.render(<StudioDraftsProvider owners={[{ owner: { kind: 'song', id: 'x' }, label: 'Song', unpublished: false }]}><Outer /></StudioDraftsProvider>));
    const clean = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(clean);
    expect(clean.defaultPrevented).toBe(false);
    act(() => outer.setPending('song:x', true));
    const dirty = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(dirty);
    expect(dirty.defaultPrevented).toBe(true);
    act(() => { outer.setPending('song:x', false); outer.setStatus({ kind: 'song', id: 'x' }, { unpublished: true }); });
    const unpub = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unpub);
    expect(unpub.defaultPrevented).toBe(true);
  });
  it('discard resets a SECTION owner\'s label to the live score title', async () => {
    vi.mocked(discardStudioDraft).mockResolvedValueOnce({
      data: { score: { title: 'Live Title' } as ScoreDocument, timing: EMPTY_TIMING, updatedAt: '' },
    });
    act(() => root.render(
      <StudioDraftsProvider owners={[{ owner: { kind: 'section', id: 's1' }, label: 'Draft Title', unpublished: true }]}>
        <Outer />
      </StudioDraftsProvider>
    ));
    await act(async () => { await outer.discard({ kind: 'section', id: 's1' }); });
    expect(outer.statuses['section:s1']).toEqual({ owner: { kind: 'section', id: 's1' }, label: 'Live Title', unpublished: false });
  });
  it('discard on an EXERCISE owner leaves its label as-is', async () => {
    vi.mocked(discardStudioDraft).mockResolvedValueOnce({
      data: { score: { title: 'Live Title' } as ScoreDocument, timing: EMPTY_TIMING, updatedAt: '' },
    });
    act(() => root.render(
      <StudioDraftsProvider owners={[{ owner: { kind: 'exercise', id: 'ci-1' }, label: 'Exercise', unpublished: true }]}>
        <Outer />
      </StudioDraftsProvider>
    ));
    await act(async () => { await outer.discard({ kind: 'exercise', id: 'ci-1' }); });
    expect(outer.statuses['exercise:ci-1']).toEqual({ owner: { kind: 'exercise', id: 'ci-1' }, label: 'Exercise', unpublished: false });
  });
});
