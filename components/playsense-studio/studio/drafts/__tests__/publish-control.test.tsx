// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const acts = vi.hoisted(() => ({ saveStudioDraft: vi.fn(), publishStudioDraft: vi.fn(), discardStudioDraft: vi.fn(), getPublishPreview: vi.fn() }));
vi.mock('@/app/actions/studio-drafts', () => acts);
import { StudioDraftsProvider } from '../drafts-context';
import { PublishControl } from '../publish-control';

let root: Root;
let host: HTMLDivElement;
const flush = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });
const btn = (text: string) => [...host.querySelectorAll('button')].find((b) => b.textContent?.trim().startsWith(text))!;

beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  vi.clearAllMocks();
  acts.getPublishPreview.mockResolvedValue({ data: { 'section:a': ['2 bars changed'], 'exercise:ci': ['Timing changed'] } });
  acts.publishStudioDraft.mockResolvedValue({ publishedAt: 'x' });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => { act(() => root.unmount()); host.remove(); });

function mount(unpub: [boolean, boolean]) {
  act(() => root.render(
    <StudioDraftsProvider owners={[
      { owner: { kind: 'section', id: 'a' }, label: 'Intro', unpublished: unpub[0] },
      { owner: { kind: 'exercise', id: 'ci' }, label: 'Exercise', unpublished: unpub[1] },
    ]}>
      <PublishControl />
    </StudioDraftsProvider>
  ));
}

describe('PublishControl', () => {
  it('is quiet and disabled with nothing unpublished', () => {
    mount([false, false]);
    expect(btn('Publish').disabled).toBe(true);
    expect(btn('Publish').className).not.toContain('is-pending');
    expect(host.textContent).not.toContain('unpublished');
  });
  it('counts unpublished parts and pulses', () => {
    mount([true, true]);
    expect(host.textContent).toContain('2 unpublished changes');
    expect(btn('Publish').className).toContain('is-pending');
  });
  it('lists each part with what changed, and publishes one', async () => {
    mount([true, true]);
    act(() => btn('Publish').click());
    await flush();
    const dialog = host.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('Publish to students');
    expect(dialog.textContent).toContain('Intro');
    expect(dialog.textContent).toContain('2 bars changed');
    expect(dialog.textContent).toContain('Publish all');
    const rowPublish = [...dialog.querySelectorAll('button')].filter((b) => b.textContent === 'Publish')[0];
    await act(async () => { rowPublish.click(); });
    await flush();
    expect(acts.publishStudioDraft).toHaveBeenCalledWith({ kind: 'section', id: 'a' });
    expect(host.textContent).toContain('1 unpublished change');
  });
  it('shows a refused publish next to its part and keeps it unpublished', async () => {
    acts.publishStudioDraft.mockResolvedValue({ error: 'This sync overlaps the section "Verse".' });
    mount([true, false]);
    act(() => btn('Publish').click());
    await flush();
    const rowPublish = [...host.querySelectorAll('[role="dialog"] button')].find((b) => b.textContent === 'Publish') as HTMLButtonElement;
    await act(async () => { rowPublish.click(); });
    await flush();
    expect(host.querySelector('[role="dialog"]')!.textContent).toContain('overlaps the section "Verse"');
    expect(host.textContent).toContain('1 unpublished change');
  });
});
