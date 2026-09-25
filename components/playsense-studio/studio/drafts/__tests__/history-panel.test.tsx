// @vitest-environment jsdom
import React, { act, useLayoutEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const acts = vi.hoisted(() => ({ saveStudioDraft: vi.fn(), publishStudioDraft: vi.fn(), discardStudioDraft: vi.fn(), listStudioVersions: vi.fn(), restoreStudioVersion: vi.fn() }));
vi.mock('@/app/actions/studio-drafts', () => acts);
import { EMPTY_TIMING } from '@/lib/playsense-studio/drafts/timing';
import { queueStudioSave } from '@/lib/playsense-studio/save-queue';
import { StudioDraftsProvider, useStudioDrafts, type StudioDraftsValue } from '../drafts-context';
import { HistoryPanel } from '../history-panel';

let root: Root;
let host: HTMLDivElement;
let ctx: StudioDraftsValue;
const adopt = vi.fn();
const owner = { kind: 'section' as const, id: 's1' };
function Probe() {
  const value = useStudioDrafts();
  useLayoutEffect(() => { ctx = value; }, [value]);
  React.useEffect(() => value.register('section:s1', { adopt }), []); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  acts.listStudioVersions.mockResolvedValue({ data: [
    { id: 'd1', kind: 'draft', createdAt: '2026-09-25T10:05:00Z', updatedAt: '2026-09-25T10:06:00Z', isLive: false },
    { id: 'p1', kind: 'published', createdAt: '2026-09-25T10:00:00Z', updatedAt: '2026-09-25T10:00:00Z', isLive: true },
  ] });
  acts.restoreStudioVersion.mockResolvedValue({ data: { score: { title: 'Old' }, timing: EMPTY_TIMING, updatedAt: 'x' } });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
  act(() => root.render(<StudioDraftsProvider owners={[{ owner, label: 'Intro', unpublished: false }]}><Probe /><HistoryPanel owner={owner} /></StudioDraftsProvider>));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

describe('HistoryPanel', () => {
  it('lists versions with the live one marked', async () => {
    act(() => (host.querySelector('button[title="History"]') as HTMLButtonElement).click());
    await flush();
    const dialog = host.querySelector('[role="dialog"]')!;
    const rows = dialog.querySelectorAll('li');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('Draft');
    expect(rows[1].textContent).toContain('Published');
    expect(rows[1].textContent).toContain('Live');
  });
  it('restore loads the version as the new draft', async () => {
    act(() => (host.querySelector('button[title="History"]') as HTMLButtonElement).click());
    await flush();
    const restore = [...host.querySelectorAll('[role="dialog"] button')].filter((b) => b.textContent === 'Restore')[1] as HTMLButtonElement;
    await act(async () => { restore.click(); });
    await flush();
    expect(acts.restoreStudioVersion).toHaveBeenCalledWith({ owner, versionId: 'p1' });
    expect(adopt).toHaveBeenCalledWith({ score: { title: 'Old' }, timing: EMPTY_TIMING });
    expect(ctx.statuses['section:s1'].unpublished).toBe(true);
    expect(host.querySelector('[role="dialog"]')).toBeNull();
  });
  it('restore pressed while a save is in flight runs after that save', async () => {
    act(() => (host.querySelector('button[title="History"]') as HTMLButtonElement).click());
    await flush();

    let resolveSave!: () => void;
    act(() => {
      void queueStudioSave('draft:section:s1', () => new Promise<void>((resolve) => { resolveSave = resolve; }));
    });

    const restore = [...host.querySelectorAll('[role="dialog"] button')].filter((b) => b.textContent === 'Restore')[1] as HTMLButtonElement;
    act(() => { restore.click(); });
    await flush();
    // Still queued behind the in-flight save — the actual restore call hasn't fired.
    expect(acts.restoreStudioVersion).not.toHaveBeenCalled();
    expect(adopt).not.toHaveBeenCalled();

    await act(async () => {
      resolveSave();
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(acts.restoreStudioVersion).toHaveBeenCalledWith({ owner, versionId: 'p1' });
    expect(adopt).toHaveBeenCalledWith({ score: { title: 'Old' }, timing: EMPTY_TIMING });
    expect(ctx.statuses['section:s1'].unpublished).toBe(true);
  });
});
