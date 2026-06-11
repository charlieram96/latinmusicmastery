# Two-Part EXERCISE Lesson Media Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the PlaySense Studio EXERCISE lesson type fully work: watch-part video upload inside the studio, exercise-part optional video cropped to the score's length, rhythm highway shown inline under the notation in the exercise studio, and instrument backing-track uploads that students select before playing.

**Architecture:** The EXERCISE class item already has two parts (Watch = `class_item_score_sections` synced to `class_items.video_url`; Exercise = graded score in `class_items.score_document_id`, fixed-BPM highway). This plan adds: (1) two new `class_items` columns (`exercise_video_url`, `exercise_video_start_seconds`) + a new `class_item_backing_tracks` table; (2) admin media panel in the exercise studio's left rail + inline `HighwayPreview` under the notation; (3) a watch-part upload screen so the demo video can be uploaded from the studio; (4) student-side backing-track selection (checkboxes before start) + a muted exercise video synced to the engine clock. Backing tracks are assumed equal-length and pre-synced — they all start at the engine's `exerciseStartTime` via the existing AudioContext scheduling.

**Tech Stack:** Next.js 16 (Turbopack), Supabase (Postgres + Storage + RLS), React 19 client components, existing PlaySense engine (`use-exercise-session`, `use-backing-track`), vitest.

**Key constraint (Turbopack deadlock):** client files under `app/admin/playsense-studio/[classItemId]/` must NOT import runtime server actions from `@/app/actions/playsense-studio` (deterministic `next build` hang). New admin client components live in `components/playsense-studio/studio/` (safe — `sync-panel.tsx` already imports actions there) or receive bound actions as props.

---

## File Structure

- Create: `supabase/migrations/029_exercise_media.sql` — columns + backing-tracks table + RLS
- Modify: `types/database.ts` — new columns + table types
- Create: `lib/play-sense/exercise-media.ts` — pure helpers: `cropWindow`, `resolveLegacyAudioUrl`
- Create: `lib/play-sense/exercise-media.test.ts` — unit tests for the helpers
- Modify: `app/actions/playsense-studio.ts` — `getExerciseMedia`, `updateExerciseVideo`, `updateClassItemVideo`, `addBackingTrack`, `updateBackingTrackLabel`, `deleteBackingTrack`
- Modify: `hooks/use-backing-track.ts` — multi-URL support (`audioUrls: string[]`)
- Modify: `hooks/use-exercise-session.ts` — accept `options.backingTrackUrls`
- Modify: `components/class-viewer/lesson-viewer/score-exercise-game.tsx` — backing-track chooser + synced exercise video
- Modify: `components/class-viewer/lesson-viewer/exercise-view.tsx` — pass-through props
- Modify: `components/class-viewer/class-item-renderer.tsx` — fetch media, wire props, audio fallback
- Create: `components/playsense-studio/studio/exercise-media-panel.tsx` — admin video upload + crop + backing tracks rail panel
- Create: `components/playsense-studio/studio/watch-video-setup.tsx` — watch-part demo video upload screen
- Modify: `app/admin/playsense-studio/[classItemId]/studio-workspace.tsx` — rail panel + inline highway in exercise mode
- Modify: `app/admin/playsense-studio/[classItemId]/exercise-studio.tsx` — enable Watch when no video → upload screen; thread exercise media props
- Modify: `app/admin/playsense-studio/[classItemId]/page.tsx` — fetch exercise media server-side
- Modify: `components/playsense-studio/studio/sync-panel.tsx` — drop the exercise-mode "Demo video" inspector card

---

### Task 1: Migration + types

**Files:**
- Create: `supabase/migrations/029_exercise_media.sql`
- Modify: `types/database.ts`

- [ ] **Step 1: Write the migration**

```sql
-- Two-part EXERCISE media:
-- 1) optional exercise-part video (plays muted, synced to the fixed-BPM clock),
--    cropped by a start offset — its visible window is exactly the score's length.
-- 2) instrument backing tracks the student can choose to hear while playing.
--    Tracks are equal-length and pre-synced; they all start at the engine's t0.

ALTER TABLE class_items
  ADD COLUMN IF NOT EXISTS exercise_video_url TEXT,
  ADD COLUMN IF NOT EXISTS exercise_video_start_seconds DOUBLE PRECISION NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS class_item_backing_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_item_id UUID NOT NULL REFERENCES class_items(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backing_tracks_class_item
  ON class_item_backing_tracks(class_item_id, order_index);

-- RLS — mirror class_item_score_sections (028): authenticated read, admin write.
ALTER TABLE class_item_backing_tracks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "class_item_backing_tracks_select_authenticated" ON class_item_backing_tracks;
CREATE POLICY "class_item_backing_tracks_select_authenticated"
  ON class_item_backing_tracks FOR SELECT USING (true);

DROP POLICY IF EXISTS "class_item_backing_tracks_admin_all" ON class_item_backing_tracks;
CREATE POLICY "class_item_backing_tracks_admin_all"
  ON class_item_backing_tracks FOR ALL
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
```

- [ ] **Step 2: Apply the migration** via the Supabase MCP server (authenticate first if needed). Fallback: report to user if no non-interactive path exists.

- [ ] **Step 3: Update `types/database.ts`** — add `exercise_video_url: string | null` and `exercise_video_start_seconds: number` to `class_items` Row (+ optional in Insert/Update), and a `class_item_backing_tracks` table entry following the generated format (Row/Insert/Update/Relationships with the `class_items` FK).

- [ ] **Step 4: `npx tsc --noEmit` passes. Commit.**

### Task 2: Pure helpers (TDD)

**Files:**
- Create: `lib/play-sense/exercise-media.ts`
- Create: `lib/play-sense/exercise-media.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest'
import { cropWindow, resolveLegacyAudioUrl } from './exercise-media'

describe('cropWindow', () => {
  it('clamps start into [0, videoDuration - scoreLength]', () => {
    expect(cropWindow(60, 20, 50)).toEqual({ maxStart: 40, start: 40, end: 60 })
    expect(cropWindow(60, 20, -5)).toEqual({ maxStart: 40, start: 0, end: 20 })
    expect(cropWindow(60, 20, 10)).toEqual({ maxStart: 40, start: 10, end: 30 })
  })
  it('pins start to 0 when the video is shorter than the score', () => {
    expect(cropWindow(15, 20, 10)).toEqual({ maxStart: 0, start: 0, end: 15 })
  })
  it('handles unknown video duration (null) by passing start through', () => {
    expect(cropWindow(null, 20, 10)).toEqual({ maxStart: null, start: 10, end: 30 })
  })
})

describe('resolveLegacyAudioUrl', () => {
  it('keeps the demo video audio only when there is no new exercise media', () => {
    expect(resolveLegacyAudioUrl({ legacyMediaUrl: 'v.mp4', hasBackingTracks: false, hasExerciseVideo: false })).toBe('v.mp4')
    expect(resolveLegacyAudioUrl({ legacyMediaUrl: 'v.mp4', hasBackingTracks: true, hasExerciseVideo: false })).toBeUndefined()
    expect(resolveLegacyAudioUrl({ legacyMediaUrl: 'v.mp4', hasBackingTracks: false, hasExerciseVideo: true })).toBeUndefined()
    expect(resolveLegacyAudioUrl({ legacyMediaUrl: null, hasBackingTracks: false, hasExerciseVideo: false })).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run — expect FAIL (module not found).**
- [ ] **Step 3: Implement**

```ts
export interface CropWindow { maxStart: number | null; start: number; end: number }

/** Crop window for the exercise-part video: a start offset whose visible window
 *  is exactly the score's fixed-BPM length. */
export function cropWindow(
  videoDurationSeconds: number | null,
  scoreLengthSeconds: number,
  requestedStartSeconds: number
): CropWindow {
  if (videoDurationSeconds == null) {
    const start = Math.max(0, requestedStartSeconds)
    return { maxStart: null, start, end: start + scoreLengthSeconds }
  }
  const maxStart = Math.max(0, videoDurationSeconds - scoreLengthSeconds)
  const start = Math.min(Math.max(0, requestedStartSeconds), maxStart)
  return { maxStart, start, end: Math.min(start + scoreLengthSeconds, videoDurationSeconds) }
}

/** Legacy play-along audio: before backing tracks existed, the demo video's audio
 *  was the engine's backing track. Keep that ONLY when no new media is authored. */
export function resolveLegacyAudioUrl(args: {
  legacyMediaUrl: string | null
  hasBackingTracks: boolean
  hasExerciseVideo: boolean
}): string | undefined {
  if (args.hasBackingTracks || args.hasExerciseVideo) return undefined
  return args.legacyMediaUrl ?? undefined
}
```

- [ ] **Step 4: Run tests — PASS. Commit.**

### Task 3: Server actions

**Files:**
- Modify: `app/actions/playsense-studio.ts`

- [ ] **Step 1: Add types + actions** (match the file's existing `requireAdmin` / result-shape conventions):

```ts
export interface BackingTrack { id: string; label: string; audioUrl: string; orderIndex: number }
export interface ExerciseMedia {
  videoUrl: string | null
  videoStartSeconds: number
  backingTracks: BackingTrack[]
}

export async function getExerciseMedia(classItemId: string): Promise<{ data?: ExerciseMedia; error?: string }>
// select exercise_video_url/exercise_video_start_seconds from class_items + ordered backing tracks; auth required (RLS covers read).

export async function updateExerciseVideo(input: { classItemId: string; videoUrl: string | null; startSeconds: number }): Promise<{ error?: string }>
// admin; null url also resets startSeconds to 0.

export async function updateClassItemVideo(input: { classItemId: string; videoUrl: string; videoDurationSeconds: number | null }): Promise<{ error?: string }>
// admin; watch-part demo video.

export async function addBackingTrack(input: { classItemId: string; label: string; audioUrl: string }): Promise<{ data?: BackingTrack; error?: string }>
// admin; order_index = current max + 1.

export async function updateBackingTrackLabel(input: { trackId: string; label: string }): Promise<{ error?: string }>
export async function deleteBackingTrack(input: { trackId: string }): Promise<{ error?: string }>
```

- [ ] **Step 2: `npx tsc --noEmit` passes. Commit.**

### Task 4: Multi-URL backing tracks in the engine

**Files:**
- Modify: `hooks/use-backing-track.ts`
- Modify: `hooks/use-exercise-session.ts`

- [ ] **Step 1: `use-backing-track.ts`** — change options to `{ audioUrls?: string[]; audioMode?: AudioMode }`. Decode all URLs in parallel into `AudioBuffer[]`; `isLoaded` = all decoded (and at least one URL); `startPlayback` creates one `AudioBufferSourceNode` per buffer, all `source.start(startTime)` through one shared gain node; `stopPlayback` stops all. Re-decode when the URL list changes (join-key dependency).

- [ ] **Step 2: `use-exercise-session.ts`** — signature `useExerciseSession(options?: { backingTrackUrls?: string[] })`. Backing URLs = `options.backingTrackUrls ?? (exercise?.audioUrl ? [exercise.audioUrl] : [])` (explicit list wins, even when empty → silence). Everything else unchanged.

- [ ] **Step 3: `npx tsc --noEmit` + `npx vitest run` pass (stage-player still compiles with no arg). Commit.**

### Task 5: Student play part — backing chooser + synced video

**Files:**
- Modify: `components/class-viewer/lesson-viewer/score-exercise-game.tsx`
- Modify: `components/class-viewer/lesson-viewer/exercise-view.tsx`
- Modify: `components/class-viewer/class-item-renderer.tsx`

- [ ] **Step 1: `score-exercise-game.tsx`** — new props `backingTracks?: BackingTrack[]`, `exerciseVideo?: { url: string; startSeconds: number } | null`. Selection state `selectedTrackIds` (default: all). Pass `backingTrackUrls` to `useExerciseSession` ONLY when `backingTracks` prop is provided (else legacy path). Render, in `selecting` state, a "Play along with" checkbox strip above the highway. Render the exercise video (muted, `playsInline`) beside the highway (`flex-col md:flex-row`, video `md:w-2/5`) when provided; a small `useEffect` watches `sessionState`/`playheadProgress`: on `playing` → seek `startSeconds + progress*duration` if drifted >0.35s and `.play()`; countdown → seek to `startSeconds`, paused; otherwise `.pause()`.

- [ ] **Step 2: `exercise-view.tsx`** — accept + forward `backingTracks` and `exerciseVideo` to both `ScoreExerciseGame` call sites.

- [ ] **Step 3: `class-item-renderer.tsx`** — for EXERCISE items fetch `getExerciseMedia(item.id)`; `audioUrl` in `scoreToExerciseDefinition` becomes `resolveLegacyAudioUrl({ legacyMediaUrl: playsenseStudioMediaUrl, hasBackingTracks, hasExerciseVideo })`; pass `backingTracks` + `exerciseVideo` (null when no URL) to `ExerciseView`.

- [ ] **Step 4: `npx tsc --noEmit` passes. Commit.**

### Task 6: Admin exercise studio — media panel + inline highway

**Files:**
- Create: `components/playsense-studio/studio/exercise-media-panel.tsx`
- Modify: `app/admin/playsense-studio/[classItemId]/studio-workspace.tsx`
- Modify: `components/playsense-studio/studio/sync-panel.tsx`
- Modify: `app/admin/playsense-studio/[classItemId]/exercise-studio.tsx`
- Modify: `app/admin/playsense-studio/[classItemId]/page.tsx`

- [ ] **Step 1: `exercise-media-panel.tsx`** (client, imports actions directly — safe location). Props: `{ classItemId, scoreLengthSeconds, initialMedia: ExerciseMedia }`. Two cards styled for the dark rail:
  - **Exercise video**: dashed upload box → upload to `course-videos` bucket (`${classItemId}-exercise-${Date.now()}.ext`, same validation as `components/admin/video-upload.tsx`) → `updateExerciseVideo`. With a video: `<video>` preview (reads duration on `loadedmetadata`), crop control = range slider 0..`cropWindow(...).maxStart` + readout `start → end (= score length)`, persisted on commit (pointer up / blur); Remove button → `updateExerciseVideo({ videoUrl: null, startSeconds: 0 })`.
  - **Backing tracks**: rows of label input (debounced `updateBackingTrackLabel`) + `<audio controls>` + delete; "Add backing track" file input → upload to `play-sense-audio` bucket → `addBackingTrack` (label defaults to filename sans extension).
- [ ] **Step 2: `studio-workspace.tsx`** — new optional prop `exerciseMedia?: ExerciseMedia`. When `mode === 'exercise' && owner.kind === 'classItem'`: render `ExerciseMediaPanel` in the left rail under `ScoreMetaEditor` (compute `scoreLengthSeconds` from `state.score` via `buildWaypoints`, memoized); render `HighwayPreview` inline in a `shrink-0` block (`h-[400px]`-ish) under `SyncPanel` inside `<main>`; hide the Preview drawer chip + drawer in exercise mode.
- [ ] **Step 3: `sync-panel.tsx`** — delete the `mode === 'exercise' && videoUrl` "Demo video" inspector card (keep the hidden clock `<video>`).
- [ ] **Step 4: `page.tsx`** — for EXERCISE items fetch `getExerciseMedia`; thread through `ExerciseStudio` → `StudioWorkspace`. `exercise-studio.tsx` accepts `exerciseMedia` prop and passes it down (type-only imports as before).
- [ ] **Step 5: `npx tsc --noEmit` passes. Commit.**

### Task 7: Watch-part video upload in the studio

**Files:**
- Create: `components/playsense-studio/studio/watch-video-setup.tsx`
- Modify: `app/admin/playsense-studio/[classItemId]/exercise-studio.tsx`

- [ ] **Step 1: `watch-video-setup.tsx`** (client, components dir). Same app-shell header as `StudioSetup` (back link + title + `appBarExtra` slot). Body: dashed video upload box → `course-videos` upload → read duration client-side from a temp `<video>` element → `updateClassItemVideo({ classItemId, videoUrl, videoDurationSeconds })` → `router.refresh()`.
- [ ] **Step 2: `exercise-studio.tsx`** — remove the `!videoUrl` guard + `disabled` on the Watch button (update its title text); `part === 'watch' && !videoUrl` renders `WatchVideoSetup` with the toggle as `appBarExtra`. Skip the `fetchSections` refetch when switching to watch with no video.
- [ ] **Step 3: `npx tsc --noEmit` passes. Commit.**

### Task 8: Full verification

- [ ] `npx vitest run` — all green (146 + new).
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npx next build` — green, with a timeout guard for the known Turbopack deadlock; if it hangs, move any offending runtime-action import in the route dir behind bound props.
- [ ] Commit; update memory file.

## Self-Review

- Spec coverage: watch upload (T7), watch sync (already live, unchanged), exercise score + grading (already live), optional croppable exercise video admin (T6) + student sync (T5), highway under notation in admin (T6), backing uploads (T6) + student selection (T5) + synced playback (T4). ✔
- Types: `ExerciseMedia`/`BackingTrack` defined once in actions (T3), imported type-only by route-dir files. ✔
- No placeholders requiring invention beyond stated conventions; executor is this session with full file context. ✔
