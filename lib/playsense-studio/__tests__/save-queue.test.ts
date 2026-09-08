import { expect, it } from 'vitest';
import { queueStudioSave } from '../save-queue';

it('keeps newer writes behind a pending score/timing save', async () => {
  const writes: string[] = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const first = queueStudioSave('score', async () => {
    writes.push('old score');
    await gate;
    writes.push('old timing');
  });
  const second = queueStudioSave('score', async () => { writes.push('new score'); });
  await queueStudioSave('other-score', async () => { writes.push('independent'); });
  expect(writes).toEqual(['old score', 'independent']);
  release();
  await Promise.all([first, second]);
  expect(writes).toEqual(['old score', 'independent', 'old timing', 'new score']);
});

it('allows retries after a rejected write', async () => {
  await expect(queueStudioSave('retry', async () => { throw new Error('offline'); })).rejects.toThrow('offline');
  await expect(queueStudioSave('retry', async () => 'saved')).resolves.toBe('saved');
});
