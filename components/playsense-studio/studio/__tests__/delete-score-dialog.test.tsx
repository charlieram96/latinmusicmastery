// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { DeleteScoreDialog } from '../delete-score-dialog';

const mocks = vi.hoisted(() => ({ detach: vi.fn(), refresh: vi.fn() }));
vi.mock('@/app/actions/playsense-studio', () => ({ detachScoreFromClassItem: mocks.detach }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh }) }));
let host: HTMLDivElement;
let root: Root;
const flush = vi.fn();
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.clearAllMocks();
  flush.mockResolvedValue({});
  mocks.detach.mockResolvedValue({ success: true });
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host);
  act(() => root.render(<DeleteScoreDialog classItemId="lesson" beforeDelete={flush} />));
});
afterEach(() => { act(() => root.unmount()); host.remove(); });
async function open() { await act(async () => { host.querySelector('button')!.click(); }); }
async function clickDialog(text: string) {
  const button = Array.from(document.querySelectorAll('[role="dialog"] button')).find(b => b.textContent === text) as HTMLButtonElement;
  await act(async () => { button.click(); });
}
it('requires confirmation and leaves the score intact on cancel', async () => {
  await open();
  expect(mocks.detach).not.toHaveBeenCalled();
  await clickDialog('Cancel');
  expect(mocks.detach).not.toHaveBeenCalled();
  expect(flush).not.toHaveBeenCalled();
});
it('flushes pending edits before detaching and refreshes after success', async () => {
  await open(); await clickDialog('Delete score');
  expect(mocks.detach).toHaveBeenCalledWith('lesson');
  expect(flush.mock.invocationCallOrder[0]).toBeLessThan(mocks.detach.mock.invocationCallOrder[0]);
  expect(mocks.refresh).toHaveBeenCalledOnce();
});
it('keeps the score when pending edits cannot be saved', async () => {
  flush.mockResolvedValue({ error: 'Save failed' });
  await open(); await clickDialog('Delete score');
  expect(mocks.detach).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('Save failed');
});
it('shows deletion errors without refreshing', async () => {
  mocks.detach.mockResolvedValue({ error: 'Delete failed' });
  await open(); await clickDialog('Delete score');
  expect(mocks.refresh).not.toHaveBeenCalled();
  expect(document.querySelector('[role="alert"]')?.textContent).toBe('Delete failed');
});
