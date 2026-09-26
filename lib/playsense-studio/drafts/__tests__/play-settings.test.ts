import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeSupabase } from './fake-supabase';

const h = vi.hoisted(() => ({ fake: null as null | ReturnType<typeof import('./fake-supabase').createFakeSupabase> }));
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => h.fake!.client }));
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

import { getExerciseMedia, setPlaySettings } from '@/app/actions/playsense-studio';

function seedExercise(overrides: Record<string, unknown> = {}) {
  h.fake = createFakeSupabase({
    class_items: [
      {
        id: 'ci-1',
        item_type: 'EXERCISE',
        exercise_video_url: 'https://example.com/play-along.mp4',
        exercise_video_start_seconds: 0,
        exercise_video_trim_in_seconds: 0,
        exercise_video_trim_out_seconds: null,
        exercise_time_map_id: null,
        metronome_anchor_seconds: null,
        metronome_anchor_qn: null,
        audio_url: null,
        play_bar1_seconds: null,
        play_count_in_bars: 1,
        play_preroll: true,
        ...overrides,
      },
    ],
    class_item_backing_tracks: [],
  });
}

function seedJamSession(overrides: Record<string, unknown> = {}) {
  h.fake = createFakeSupabase({
    class_items: [
      {
        id: 'ci-jam',
        item_type: 'JAM_SESSION',
        audio_url: 'https://example.com/jam.mp3',
        exercise_video_url: null,
        exercise_video_start_seconds: 0,
        exercise_video_trim_in_seconds: 0,
        exercise_video_trim_out_seconds: null,
        exercise_time_map_id: null,
        metronome_anchor_seconds: null,
        metronome_anchor_qn: null,
        play_bar1_seconds: 2.5,
        play_count_in_bars: 2,
        play_preroll: false,
        ...overrides,
      },
    ],
    class_item_backing_tracks: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  seedExercise();
});
afterEach(() => vi.restoreAllMocks());

describe('getExerciseMedia — play settings', () => {
  it('returns the play settings for an EXERCISE item', async () => {
    seedExercise({ play_bar1_seconds: 1.2, play_count_in_bars: 2, play_preroll: false });
    const res = await getExerciseMedia('ci-1');
    expect(res.error).toBeUndefined();
    expect(res.data!.play).toEqual({ bar1Seconds: 1.2, countInBars: 2, preroll: false });
  });

  it('defaults play settings sanely when unset', async () => {
    const res = await getExerciseMedia('ci-1');
    expect(res.data!.play).toEqual({ bar1Seconds: null, countInBars: 1, preroll: true });
  });

  it('uses audio_url as the media URL for a JAM_SESSION item and skips the exercise video columns', async () => {
    seedJamSession();
    const res = await getExerciseMedia('ci-jam');
    expect(res.error).toBeUndefined();
    expect(res.data!.videoUrl).toBe('https://example.com/jam.mp3');
    expect(res.data!.play).toEqual({ bar1Seconds: 2.5, countInBars: 2, preroll: false });
  });

  it("falls back to the jam's video_url when it has no audio_url", async () => {
    seedJamSession({ audio_url: null, video_url: 'https://example.com/jam.mp4' });
    const res = await getExerciseMedia('ci-jam');
    expect(res.error).toBeUndefined();
    expect(res.data!.videoUrl).toBe('https://example.com/jam.mp4');
  });

  it('prefers the jam audio_url over its video_url', async () => {
    seedJamSession({ video_url: 'https://example.com/jam.mp4' });
    const res = await getExerciseMedia('ci-jam');
    expect(res.data!.videoUrl).toBe('https://example.com/jam.mp3');
  });
});

describe('setPlaySettings', () => {
  it('is admin-only', async () => {
    h.fake = createFakeSupabase({ class_items: [{ id: 'ci-1', play_bar1_seconds: null, play_count_in_bars: 1, play_preroll: true }] }, { isAdmin: false });
    const res = await setPlaySettings({ classItemId: 'ci-1', bar1Seconds: 1, countInBars: 1, preroll: true });
    expect(res.error).toBe('Admin only');
  });

  it('updates the three columns', async () => {
    const res = await setPlaySettings({ classItemId: 'ci-1', bar1Seconds: 3.4, countInBars: 2, preroll: false });
    expect(res.error).toBeUndefined();
    expect(res.success).toBe(true);
    const row = h.fake!.tables.class_items.find((r) => r.id === 'ci-1')!;
    expect(row.play_bar1_seconds).toBe(3.4);
    expect(row.play_count_in_bars).toBe(2);
    expect(row.play_preroll).toBe(false);
  });

  it('accepts a null bar1Seconds', async () => {
    seedExercise({ play_bar1_seconds: 5 });
    const res = await setPlaySettings({ classItemId: 'ci-1', bar1Seconds: null, countInBars: 1, preroll: true });
    expect(res.error).toBeUndefined();
    const row = h.fake!.tables.class_items.find((r) => r.id === 'ci-1')!;
    expect(row.play_bar1_seconds).toBeNull();
  });

  it.each([0, 3, -1, 1.5])('rejects an out-of-range countInBars (%s)', async (countInBars) => {
    const res = await setPlaySettings({ classItemId: 'ci-1', bar1Seconds: 1, countInBars: countInBars as 1 | 2, preroll: true });
    expect(res.error).toBeTruthy();
    const row = h.fake!.tables.class_items.find((r) => r.id === 'ci-1')!;
    // Untouched — the invalid write never reaches the table.
    expect(row.play_count_in_bars).toBe(1);
  });
});
