// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { TempoMarksNotice } from '../tempo-marks-notice';

let root: Root;
let host: HTMLDivElement;
beforeEach(() => {
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  host = document.createElement('div');
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
});

const doc = (tempos: Array<number | undefined>): ScoreDocument => ({
  schemaVersion: 1, title: 't', sourceFormat: 'musicxml', initialTempo: 96, initialTimeSignature: [4, 4], initialKeyFifths: 0,
  tracks: [{ index: 0, instrument: 'piano', displayName: 'Piano', tuning: null, stringMultiplicity: 1, channel: 0, defaultView: 'staff',
    measures: tempos.map((t, i) => ({ number: i + 1, voices: [{ number: 1, events: [] }], ...(t === undefined ? {} : { tempoChange: t }) })) }],
});

describe('TempoMarksNotice', () => {
  it('says marks set here are ignored too until kept, and keeps both buttons', () => {
    const dispatch = vi.fn();
    act(() => root.render(<TempoMarksNotice score={doc([undefined, 120, 100])} dispatch={dispatch} />));
    expect(host.querySelector('p')!.textContent).toBe(
      'This score has tempo marks that differ from the lesson tempo (96 BPM): m.2 ♩=120, m.3 ♩=100. '
      + 'Graded play ignores them until you keep them — this includes marks you set here.',
    );
    expect([...host.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Keep them', 'Clear them']);
    expect(dispatch).not.toHaveBeenCalled();
  });
});
