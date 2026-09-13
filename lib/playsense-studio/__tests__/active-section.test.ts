import { describe, expect, it } from 'vitest';
import { pickActiveSection, pickDisplaySection, type SectionRange } from '../active-section';

describe('pickActiveSection', () => {
  const sections: SectionRange[] = [
    { videoStartSeconds: 4, videoEndSeconds: 5.5 }, // 0:04–0:05.5
    { videoStartSeconds: 14, videoEndSeconds: 16 }, // 0:14–0:16
  ];

  it('returns -1 during a talking gap (no section contains the time)', () => {
    expect(pickActiveSection(sections, 0)).toBe(-1);
    expect(pickActiveSection(sections, 8)).toBe(-1);
    expect(pickActiveSection(sections, 20)).toBe(-1);
  });

  it('selects the section whose range contains the time', () => {
    expect(pickActiveSection(sections, 4)).toBe(0);
    expect(pickActiveSection(sections, 5)).toBe(0);
    expect(pickActiveSection(sections, 14)).toBe(1);
    expect(pickActiveSection(sections, 16)).toBe(1);
  });

  it('treats range bounds as inclusive', () => {
    expect(pickActiveSection(sections, 5.5)).toBe(0);
    expect(pickActiveSection(sections, 14)).toBe(1);
  });

  it('prefers the latest-starting eligible section when ranges overlap', () => {
    const overlapping: SectionRange[] = [
      { videoStartSeconds: 0, videoEndSeconds: 30 },
      { videoStartSeconds: 10, videoEndSeconds: 20 },
    ];
    expect(pickActiveSection(overlapping, 5)).toBe(0);
    expect(pickActiveSection(overlapping, 15)).toBe(1); // both eligible → later start wins
    expect(pickActiveSection(overlapping, 25)).toBe(0);
  });

  it('a null start is always eligible (synthetic single section)', () => {
    const single: SectionRange[] = [{ videoStartSeconds: null, videoEndSeconds: null }];
    expect(pickActiveSection(single, 0)).toBe(0);
    expect(pickActiveSection(single, 9999)).toBe(0);
  });

  it('a null end stays active to the end of the video', () => {
    const openEnded: SectionRange[] = [{ videoStartSeconds: 10, videoEndSeconds: null }];
    expect(pickActiveSection(openEnded, 9)).toBe(-1);
    expect(pickActiveSection(openEnded, 10)).toBe(0);
    expect(pickActiveSection(openEnded, 100000)).toBe(0);
  });
});

describe('pickDisplaySection', () => {
  const sections: SectionRange[] = [
    { videoStartSeconds: 4, videoEndSeconds: 5.5 },
    { videoStartSeconds: 14, videoEndSeconds: 16 },
  ];

  it('previews the first score for the whole intro, including its last frames', () => {
    expect(pickDisplaySection(sections, 0)).toBe(0);
    expect(pickDisplaySection(sections, 3.9)).toBe(0);
    // 20 ms before the first score begins the staff must not swap to another score.
    expect(pickDisplaySection(sections, 3.98)).toBe(0);
    expect(pickDisplaySection(sections, 4)).toBe(0);
  });

  it('shows the active section', () => {
    expect(pickDisplaySection(sections, 5)).toBe(0);
    expect(pickDisplaySection(sections, 15)).toBe(1);
  });

  it('keeps the section that just ended through its trailing gap', () => {
    expect(pickDisplaySection(sections, 5.5)).toBe(0);
    expect(pickDisplaySection(sections, 13.99)).toBe(0);
    expect(pickDisplaySection(sections, 20)).toBe(1);
  });

  it('falls back to the first section when nothing is placed', () => {
    const unplaced: SectionRange[] = [{ videoStartSeconds: null, videoEndSeconds: null }];
    expect(pickDisplaySection(unplaced, 0)).toBe(0);
    expect(pickDisplaySection([], 0)).toBe(-1);
  });
});
