import { describe, expect, it } from 'vitest';
import { studioModeFor } from '../studio-mode';

describe('studioModeFor', () => {
  it('routes VIDEO to the sections workspace', () => {
    expect(studioModeFor('VIDEO')).toBe('videoSections');
  });

  it('routes EXERCISE to the two-part exercise studio', () => {
    expect(studioModeFor('EXERCISE')).toBe('exerciseStudio');
  });

  it('routes JAM_SESSION to the graded workspace (Studio rework P5, Task 8)', () => {
    expect(studioModeFor('JAM_SESSION')).toBe('gradedWorkspace');
  });

  it('falls back to the legacy single-score workspace for anything else', () => {
    expect(studioModeFor('QUIZ')).toBe('legacyWorkspace');
    expect(studioModeFor('SOMETHING_FUTURE')).toBe('legacyWorkspace');
  });
});
