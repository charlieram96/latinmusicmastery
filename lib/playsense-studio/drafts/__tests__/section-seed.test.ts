import { describe, expect, it } from 'vitest';
import { sectionSeed, sectionDraftRange, sectionTimelineSeeds, orderedScoreSections } from '../seed';
import { EMPTY_TIMING } from '@/lib/playsense-studio/drafts/timing';

const wp = (qn: number, s: number) => ({ musicalPositionQN: qn, videoTimeSeconds: s, measureNumber: null, beatInMeasure: null });
const base = {
  sectionId: 's1', sectionIndex: 0, label: null, videoStartSeconds: 1, videoEndSeconds: 3,
  metronomeAnchorSeconds: 1, metronomeAnchorQn: 0, tracks: [],
  scoreDocument: { id: 'doc-1', title: 'Live', composer: null, parsedScore: { title: 'Live' } },
  activeTimeMap: { id: 'tm-1', method: 'drag', params: { pps: 40 }, waypoints: [wp(0, 1), wp(4, 3)], nudges: [] },
};

describe('sectionSeed', () => {
  it('opens on the live content when there is no draft', () => {
    const seed = sectionSeed({ ...base, studioDraft: null } as never);
    expect((seed.score as { title: string }).title).toBe('Live');
    expect(seed.timeMap?.waypoints).toEqual([wp(0, 1), wp(4, 3)]);
    expect(seed.timing.anchor).toEqual({ seconds: 1, qn: 0 });
    expect(seed.anchorSeconds).toBe(1);
  });
  it('opens on the draft when one exists', () => {
    const timing = { ...EMPTY_TIMING, waypoints: [wp(0, 2), wp(4, 4)], anchor: { seconds: 2, qn: 0 } };
    const seed = sectionSeed({ ...base, studioDraft: { score: { title: 'Draft' }, timing, updatedAt: 'x' } } as never);
    expect((seed.score as { title: string }).title).toBe('Draft');
    expect(seed.timeMap?.waypoints).toEqual([wp(0, 2), wp(4, 4)]);
    expect(seed.anchorSeconds).toBe(2);
  });
});

describe('section draft timeline ranges', () => {
  it('keeps independently placed drafts visible, including unpublished sections', () => {
    const first = { ...base, studioDraft: { score: {}, timing: { ...EMPTY_TIMING, waypoints: [wp(0, 82), wp(8, 104)] } } };
    const second = { ...base, sectionId: 's2', videoStartSeconds: null, videoEndSeconds: null,
      studioDraft: { score: {}, timing: { ...EMPTY_TIMING, waypoints: [wp(0, 120), wp(8, 128)] } } };
    expect([first, second].map(s => sectionDraftRange(s as never))).toEqual([
      { startSeconds: 82, endSeconds: 104 }, { startSeconds: 120, endSeconds: 128 }
    ]);
    second.studioDraft.timing.waypoints = [wp(0, 140), wp(8, 148)];
    expect(sectionDraftRange(second as never)).toEqual({ startSeconds: 140, endSeconds: 148 });
    expect(sectionDraftRange(first as never)).toEqual({ startSeconds: 82, endSeconds: 104 });
  });
  it('does not revive a published placement when the draft is unplaced', () => {
    expect(sectionDraftRange({ ...base, studioDraft: { score: {}, timing: EMPTY_TIMING } } as never))
      .toEqual({ startSeconds: null, endSeconds: null });
  });
});

it('previews new imports after earlier placements without changing either source', () => {
  const score = { title:'New', initialTempo:120, initialTimeSignature:[4,4], tracks:[{measures:[{number:1, voices:[]}]}] };
  const first = { ...base, studioDraft: null };
  const second = { ...base, sectionId:'second', activeTimeMap:null, videoStartSeconds:null, videoEndSeconds:null,
    scoreDocument:{...base.scoreDocument, parsedScore:score}, studioDraft:null };
  const before = JSON.stringify([first,second]);
  const lanes = sectionTimelineSeeds([first,second] as never);
  expect(lanes.map(s=>[s.startSeconds,s.endSeconds,s.preview])).toEqual([[1,3,false],[3,5,true]]);
  expect(JSON.stringify([first,second])).toBe(before);
});

it('orders identical titles by live draft position, then unplaced uploads, without mutating them', () => {
 const source=[
  {...base,sectionId:'late',sectionIndex:0,studioDraft:{score:{title:'Same'},timing:{...EMPTY_TIMING,waypoints:[wp(0,30),wp(4,32)]}}},
  {...base,sectionId:'new',sectionIndex:2,studioDraft:{score:{title:'Same'},timing:EMPTY_TIMING}},
  {...base,sectionId:'early',sectionIndex:1,studioDraft:{score:{title:'Same'},timing:{...EMPTY_TIMING,waypoints:[wp(0,10),wp(4,12)]}}},
 ];
 expect(orderedScoreSections(source as never).map(s=>s.sectionId)).toEqual(['early','late','new']);
 expect(source.map(s=>s.sectionId)).toEqual(['late','new','early']);
 source[0].studioDraft.timing.waypoints=[wp(0,5),wp(4,7)];
 expect(orderedScoreSections(source as never).map(s=>s.sectionId)).toEqual(['late','early','new']);
});
