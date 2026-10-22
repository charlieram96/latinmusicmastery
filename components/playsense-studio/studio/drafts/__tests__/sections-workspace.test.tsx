// @vitest-environment jsdom
//
// Review Focus 5 / fix round 1 (C2): leaving a section with unsaved work and
// coming back later must show that work, not whatever the last refetch saw.
// ScoreSectionEditor is stubbed out entirely (its own drafts wiring is covered
// by use-studio-draft.test.tsx) so this test can drive VideoSectionsWorkspace's
// onDraftContent handler directly and check it reseeds the reselected section.
import React, { act } from 'react';
vi.mock('@/app/actions/continuous-score-project',()=>({getContinuousScoreProject:vi.fn().mockResolvedValue(undefined),startContinuousScoreProject:vi.fn()}));
vi.mock('@/components/playsense-studio/studio/score-import-dialog', () => ({ ScoreImportDialog: () => null }));
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const stub = vi.hoisted(() => ({
  lanes: [] as Array<{sectionId:string;label:string}>,
  mounts: [] as Array<{ sectionId: string; title: string }>,
  current: null as null | { sectionId: string; onDraftContent?: (c: { score: { title: string }; timing: unknown }) => void },
}));
vi.mock('@/components/playsense-studio/studio/score-section-editor', () => ({
  ScoreSectionEditor: (props: { sections?: Array<{sectionId:string;label:string}>; sectionId: string; initialScore: { title: string }; onDraftContent?: (c: { score: { title: string }; timing: unknown }) => void }) => {
    stub.lanes=props.sections ?? [];
    stub.mounts.push({ sectionId: props.sectionId, title: props.initialScore.title });
    stub.current = { sectionId: props.sectionId, onDraftContent: props.onDraftContent };
    return null;
  },
}));

vi.mock('@/app/actions/playsense-studio', () => ({
  getLessonMetronome: vi.fn().mockResolvedValue({ data: null }),
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
    (b) => b.closest('nav[aria-label="Scored sections"]') && b.textContent?.startsWith(startsWith)
  );
  if (!btn) throw new Error(`row not found: ${startsWith}`);
  act(() => btn.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true })));
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
    clickRow('1 · B');
    expect(stub.current?.sectionId).toBe('sec-b');

    // ...then come back to A. A fresh stub instance mounts; it must open on
    // the edited content, not the stale live title.
    clickRow('2 · A');
    expect(stub.current?.sectionId).toBe('sec-a');
    const aMounts = stub.mounts.filter((m) => m.sectionId === 'sec-a');
    expect(aMounts.at(-1)?.title).toBe('A edited');
  });
});

it('shows numbered matching titles in continuous score rows and timeline lanes',async()=>{
 const api=await import('@/app/actions/continuous-score-project');
 vi.mocked(api.getContinuousScoreProject).mockResolvedValueOnce({version:1,title:'Continuous',classItemId:'ci-1',sectionIds:['sec-a','sec-b'],durationSeconds:10,backupPath:''});
 const same=[sectionA,sectionB].map(s=>({...s,scoreDocument:{...s.scoreDocument,title:'Left hand',parsedScore:{title:'Left hand'} as never}}));
 await act(async()=>{root.render(<VideoSectionsWorkspace classItemId="ci-1" title="Lesson" videoUrl={null} videoDurationSeconds={null} initialSections={same}/>);});
 expect(stub.lanes.map(s=>s.label)).toEqual(['1 · Continuous','2 · Left hand']);
 const cards=[...host.querySelectorAll('[data-score-section-card]')];
 expect(cards).toHaveLength(2);
 expect(cards[0].textContent).toContain('1 · Continuous');
 expect(cards[1].textContent).toContain('2 · Left hand');
 const nav=host.querySelector('nav[aria-label="Scored sections"]')!;
 expect(nav.textContent).toContain('1 · Continuous');
 expect(nav.textContent).toContain('2 · Left hand');
});
