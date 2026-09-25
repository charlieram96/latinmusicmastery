// @vitest-environment jsdom
//
// Fix round 1, item 2: switching back to Exercise must not swallow a failed
// draft fetch, and must not race the unmount flush. StudioWorkspace and
// VideoSectionsWorkspace are stubbed out entirely (their own drafts wiring is
// covered elsewhere) so this test can drive ExerciseStudio's switchPart
// directly, the same way sections-workspace.test.tsx drives VideoSectionsBody
// with ScoreSectionEditor stubbed.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stub = vi.hoisted(() => ({
  studioMounts: [] as Array<{ studioDraft: unknown }>,
  sectionsMountCount: 0,
}));

vi.mock('@/app/admin/playsense-studio/[classItemId]/studio-workspace', () => ({
  StudioWorkspace: (props: { studioDraft: unknown; appBarExtra?: React.ReactNode }) => {
    stub.studioMounts.push({ studioDraft: props.studioDraft });
    return <div>{props.appBarExtra}</div>;
  },
}));
vi.mock('@/app/admin/playsense-studio/[classItemId]/video-sections-workspace', () => ({
  VideoSectionsWorkspace: (props: { appBarExtra?: React.ReactNode }) => {
    stub.sectionsMountCount += 1;
    return <div>{props.appBarExtra}</div>;
  },
}));

import { ExerciseStudio } from '@/app/admin/playsense-studio/[classItemId]/exercise-studio';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const SCORE = { title: 'Graded' } as unknown as ScoreDocument;

let host: HTMLDivElement;
let root: Root;

function clickToggle(label: 'Watch' | 'Exercise') {
  const btn = Array.from(host.querySelectorAll('button')).find((b) => b.textContent?.trim() === label);
  if (!btn) throw new Error(`toggle not found: ${label}`);
  return act(async () => {
    btn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
}

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  stub.studioMounts = [];
  stub.sectionsMountCount = 0;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('ExerciseStudio — switching to Exercise aborts when the draft fetch fails', () => {
  it('keeps the current part, shows the error, and preserves the cached draft', async () => {
    const initialDraft = {
      score: { title: 'Original draft' } as unknown as ScoreDocument,
      timing: { method: 'drag' as const, params: {}, waypoints: [], anchor: null },
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const fetchSections = vi.fn().mockResolvedValue({ data: [] });
    const fetchExercise = vi.fn().mockResolvedValue({
      data: { scoreDocument: { id: 'doc-1', title: 'Graded', composer: null, parsedScore: SCORE }, tracks: [], activeTimeMap: null },
    });
    const fetchExerciseMedia = vi.fn().mockResolvedValue({ data: null });
    const fetchExerciseDraft = vi.fn();

    act(() => {
      root.render(
        <ExerciseStudio
          classItemId="ci-1"
          title="Lesson"
          videoUrl="https://example.com/video.mp4"
          videoDurationSeconds={60}
          initialSections={[]}
          scoreDocumentId="doc-1"
          initialScore={SCORE}
          activeTimeMap={null}
          initialExerciseMedia={null}
          initialExerciseDraft={initialDraft}
          fetchSections={fetchSections}
          fetchExercise={fetchExercise}
          fetchExerciseMedia={fetchExerciseMedia}
          fetchExerciseDraft={fetchExerciseDraft}
        />
      );
    });

    // Starts on Exercise; StudioWorkspace renders with the initial draft.
    // (React's async-transition settling can re-render the same instance more
    // than once, so this asserts on the LAST recorded props, not a count.)
    expect(stub.studioMounts.at(-1)?.studioDraft).toEqual(initialDraft);

    // Switch to Watch — succeeds.
    await clickToggle('Watch');
    expect(stub.sectionsMountCount).toBeGreaterThan(0);
    const studioMountsAfterWatch = stub.studioMounts.length;

    // Switching back to Exercise fails to fetch the draft.
    fetchExerciseDraft.mockResolvedValueOnce({ error: 'Could not load the draft.' });
    await clickToggle('Exercise');

    // Aborted: still on Watch (no new StudioWorkspace render), error shown.
    expect(stub.studioMounts).toHaveLength(studioMountsAfterWatch);
    expect(host.textContent).toContain('Could not load the draft.');

    // A retry that succeeds recovers, proving the failed attempt didn't get
    // stuck or corrupt anything.
    fetchExerciseDraft.mockResolvedValueOnce({ data: {} });
    await clickToggle('Exercise');
    expect(stub.studioMounts.length).toBeGreaterThan(studioMountsAfterWatch);
    expect(stub.studioMounts.at(-1)?.studioDraft).toBeNull();
  });
});
