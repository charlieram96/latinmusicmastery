// @vitest-environment jsdom
//
// Review Focus 5 / fix round 1 (C2): leaving a section with unsaved work and
// coming back later must show that work, not whatever the last refetch saw.
// ScoreSectionEditor is stubbed out entirely (its own drafts wiring is covered
// by use-studio-draft.test.tsx) so this test can drive VideoSectionsWorkspace's
// onDraftContent handler directly and check it reseeds the reselected section.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stub = vi.hoisted(() => ({
  mounts: [] as Array<{ sectionId: string; title: string }>,
  current: null as null | { sectionId: string; onDraftContent?: (c: { score: { title: string }; timing: unknown }) => void },
}));
vi.mock('@/components/playsense-studio/studio/score-section-editor', () => ({
  ScoreSectionEditor: (props: { sectionId: string; initialScore: { title: string }; onDraftContent?: (c: { score: { title: string }; timing: unknown }) => void }) => {
    stub.mounts.push({ sectionId: props.sectionId, title: props.initialScore.title });
    stub.current = { sectionId: props.sectionId, onDraftContent: props.onDraftContent };
    return null;
  },
}));

vi.mock('@/app/actions/playsense-studio', () => ({
  getStudioScoreSectionsForClassItem: vi.fn(),
  createBlankSection: vi.fn(),
  createSectionFromImport: vi.fn(),
  deleteSection: vi.fn(),
  updateClassItemVideoTrim: vi.fn(),
}));

import { VideoSectionsWorkspace } from '@/app/admin/playsense-studio/[classItemId]/video-sections-workspace';
import type { ClassItemScoreSection } from '@/app/actions/playsense-studio';
import { EMPTY_TIMING } from '@/lib/playsense-studio/drafts/timing';

function makeSection(id: string, title: string): ClassItemScoreSection {
  return {
    scoreDocument: { id: `doc-${id}`, title, composer: null, parsedScore: { title } as never },
    tracks: [],
    activeTimeMap: null,
    sectionId: id,
    sectionIndex: id === 'sec-a' ? 0 : 1,
    label: null,
    videoStartSeconds: id === 'sec-a' ? 0 : 2,
    videoEndSeconds: id === 'sec-a' ? 2 : 4,
    studioDraft: null,
    metronomeAnchorSeconds: null,
    metronomeAnchorQn: null,
  };
}

const sectionA = makeSection('sec-a', 'A');
const sectionB = makeSection('sec-b', 'B');

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  stub.mounts = [];
  stub.current = null;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

function clickRow(startsWith: string) {
  const btn = Array.from(host.querySelectorAll('button')).find(
    (b) => b.className.includes('min-w-0 flex-1') && b.textContent?.startsWith(startsWith)
  );
  if (!btn) throw new Error(`row not found: ${startsWith}`);
  act(() => btn.dispatchEvent(new MouseEvent('click', { bubbles: true })));
}

describe('VideoSectionsWorkspace — onDraftContent reseeds a reselected section (C2)', () => {
  it('shows the last onDraftContent content after leaving the section and coming back', () => {
    act(() => {
      root.render(
        <VideoSectionsWorkspace
          classItemId="ci-1"
          title="Lesson"
          videoUrl={null}
          videoDurationSeconds={null}
          initialSections={[sectionA, sectionB]}
        />
      );
    });

    // A is selected first (sections[0]) and its stub mounts with the live title.
    expect(stub.current?.sectionId).toBe('sec-a');
    expect(stub.mounts.at(-1)).toEqual({ sectionId: 'sec-a', title: 'A' });

    // The admin edits A; the (mocked) editor reports the new draft content —
    // this is what the real useStudioDraft hook does after a successful save
    // or at unmount, per use-studio-draft.test.tsx.
    act(() => {
      stub.current!.onDraftContent!({ score: { title: 'A edited' }, timing: EMPTY_TIMING });
    });

    // Leave the section (select B — A's stub instance unmounts)...
    clickRow('B');
    expect(stub.current?.sectionId).toBe('sec-b');

    // ...then come back to A. A fresh stub instance mounts; it must open on
    // the edited content, not the stale live title.
    clickRow('A');
    expect(stub.current?.sectionId).toBe('sec-a');
    const aMounts = stub.mounts.filter((m) => m.sectionId === 'sec-a');
    expect(aMounts.at(-1)?.title).toBe('A edited');
  });
});
