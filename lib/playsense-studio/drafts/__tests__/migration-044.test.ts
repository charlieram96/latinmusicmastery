import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(path.resolve(__dirname, '../../../../supabase/migrations/044_play_settings.sql'), 'utf8');

describe('044_play_settings', () => {
  it('adds the three play_* columns, additively', () => {
    expect(sql).toMatch(/alter table class_items/i);
    expect(sql).toMatch(/add column if not exists play_bar1_seconds\s+numeric/i);
    expect(sql).toMatch(/add column if not exists play_count_in_bars\s+smallint not null default 1/i);
    expect(sql).toMatch(/add column if not exists play_preroll\s+boolean not null default true/i);
  });

  it('constrains play_count_in_bars to 1 or 2', () => {
    expect(sql).toMatch(/check\s*\(\s*play_count_in_bars between 1 and 2\s*\)/i);
  });

  it('backfills play_bar1_seconds from the lowest musical_position_qn waypoint of each exercise_time_map_id', () => {
    // Guarded so a re-run never overwrites an already-set value.
    expect(sql).toMatch(/play_bar1_seconds is null/i);
    // Joins score_time_waypoints for the item's own exercise_time_map_id.
    expect(sql).toMatch(/w\.time_map_id = ci\.exercise_time_map_id/i);
    // Picks the FIRST waypoint: the minimum musical_position_qn for that map.
    expect(sql).toMatch(/min\(w2\.musical_position_qn\)/i);
    expect(sql).toMatch(/set\s+play_bar1_seconds\s*=\s*w\.video_time_seconds/i);
  });
});
