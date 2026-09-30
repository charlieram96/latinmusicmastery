// @vitest-environment jsdom
//
// Studio rework P5, Task 7: the Student preview dialog runs the REAL
// ScoreExerciseGame (in preview mode) so the Studio's preview can never drift
// from what students see (Decision 2). The game itself is heavy (audio, video,
// hardware) and is exercised by its own tests, so it's stubbed here — this
// suite only covers the dialog's own contract: it renders the stub with the
// exercise/score/play/media/backingTracks props, and it closes on Esc and on
// the close button.
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ExerciseDefinition } from '@/lib/play-sense/types';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';

const gameCalls: Array<Record<string, unknown>> = [];
vi.mock('@/components/class-viewer/lesson-viewer/score-exercise-game', () => ({
  ScoreExerciseGame: (props: Record<string, unknown>) => {
    gameCalls.push(props);
    return null;
  },
}));

import { StudentPreviewDialog } from '../student-preview-dialog';

const EXERCISE: ExerciseDefinition = {
  id: 'preview',
  title: 'Clave 101',
  description: '',
  instrument: 'conga',
  bpm: 100,
  timeSignature: [4, 4],
  swing: 0,
  difficulty: 'intermediate',
  measures: 1,
  loopCount: 1,
  events: [],
};

const SCORE: ScoreDocument = {
  schemaVersion: 1,
  title: 'Clave 101',
  sourceFormat: 'native',
  initialTempo: 100,
  initialTimeSignature: [4, 4],
  initialKeyFifths: 0,
  tracks: [],
};

let host: HTMLDivElement;
let root: Root;

beforeEach(() => {
  gameCalls.length = 0;
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root.unmount());
  host.remove();
});

describe('StudentPreviewDialog', () => {
  it('renders as a labeled dialog and hands the real game the exercise, score, media and play props', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(
        <StudentPreviewDialog
          exercise={EXERCISE}
          score={SCORE}
          exerciseVideo={{ url: 'https://example.com/v.mp4', startSeconds: 1, trimOutSeconds: 9, timeMap: null }}
          play={{ bar1Seconds: 1.5, countInBars: 2, preroll: false }}
          backingTracks={[]}
          onClose={onClose}
        />
      );
    });

    const dialog = host.querySelector('[role="dialog"]');
    expect(dialog).toBeTruthy();
    expect(dialog?.getAttribute('aria-label')).toBeTruthy();

    expect(gameCalls).toHaveLength(1);
    expect(gameCalls[0].preview).toBe(true);
    expect(gameCalls[0].exercise).toBe(EXERCISE);
    expect(gameCalls[0].score).toBe(SCORE);
    expect(gameCalls[0].play).toEqual({ bar1Seconds: 1.5, countInBars: 2, preroll: false });
    expect(gameCalls[0].exerciseVideo).toEqual({
      url: 'https://example.com/v.mp4',
      startSeconds: 1,
      trimOutSeconds: 9,
      timeMap: null,
    });
    expect(gameCalls[0].backingTracks).toEqual([]);
  });

  it('defaults the optional media/play/backing-track props', () => {
    act(() => {
      root.render(<StudentPreviewDialog exercise={EXERCISE} score={SCORE} onClose={vi.fn()} />);
    });
    expect(gameCalls[0].exerciseVideo ?? null).toBeNull();
    expect(gameCalls[0].play ?? null).toBeNull();
    expect(gameCalls[0].mediaAudible ?? false).toBe(false);
  });

  it('passes mediaAudible through to the game, for a jam session preview (Studio rework P5, Task 8 fix round 1)', () => {
    act(() => {
      root.render(
        <StudentPreviewDialog exercise={EXERCISE} score={SCORE} onClose={vi.fn()} mediaAudible />
      );
    });
    expect(gameCalls[0].mediaAudible).toBe(true);
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(<StudentPreviewDialog exercise={EXERCISE} score={SCORE} onClose={onClose} />);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on the close button', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(<StudentPreviewDialog exercise={EXERCISE} score={SCORE} onClose={onClose} />);
    });
    const closeBtn = Array.from(host.querySelectorAll('button')).find((b) =>
      (b.getAttribute('aria-label') ?? '').toLowerCase().includes('close')
    ) as HTMLButtonElement;
    expect(closeBtn).toBeTruthy();
    act(() => {
      closeBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on a plain (non-Escape) key', () => {
    const onClose = vi.fn();
    act(() => {
      root.render(<StudentPreviewDialog exercise={EXERCISE} score={SCORE} onClose={onClose} />);
    });
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

it('opens the requested cáscara demo in Spanish even with the default English context', () => {
  const host = document.createElement('div');
  const root = createRoot(host);
  try {
    act(() => root.render(<StudentPreviewDialog exercise={{ ...EXERCISE, id: 'f7fee0dd-66bb-4e08-9af0-e38febfa415b' }} score={SCORE} onClose={vi.fn()} />));
    expect(host.querySelector('[role="dialog"]')?.getAttribute('aria-label')).toBe('Vista del estudiante');
    expect(host.querySelector('button')?.getAttribute('aria-label')).toBe('Cerrar vista del estudiante');
  } finally { act(() => root.unmount()); }
});
