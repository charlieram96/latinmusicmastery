// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { StaffRenderer, type StaffLayoutMode } from '../staff-renderer';

beforeAll(() => {
  // VexFlow measures text through a canvas; jsdom has none.
  const ctx = { measureText: (s: string) => ({ width: String(s).length * 7, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2, fontBoundingBoxAscent: 8, fontBoundingBoxDescent: 2 }), font: '' };
  HTMLCanvasElement.prototype.getContext = (() => ctx) as never;
});

/** Four bars of quarter notes in D major (two sharps). */
function dMajorScore(): ScoreDocument {
  return {
    schemaVersion: 1, title: 'T', sourceFormat: 'native', initialTempo: 120,
    initialTimeSignature: [4, 4], initialKeyFifths: 2,
    tracks: [{
      index: 0, instrument: 'staff', displayName: 'T', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
      measures: [1, 2, 3, 4].map(number => ({ number, voices: [{ number: 1, events: [62, 64, 66, 67].map(midi => ({ kind: 'note' as const, midi, durationQN: 1 })) }] })),
    }],
  } as ScoreDocument;
}

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

function render(layoutMode: StaffLayoutMode) {
  act(() => { root.render(<StaffRenderer score={dMajorScore()} trackIndex={0} currentMs={0} layoutMode={layoutMode} />); });
  return {
    keySignatures: host.querySelectorAll('.vf-keysignature').length,
    clefs: host.querySelectorAll('.vf-clef').length,
  };
}

describe('wrapped rows restate the key signature', () => {
  it('draws the clef and key signature at the start of every wrapped row', () => {
    // jsdom has no width, so each bar wraps onto its own row.
    const { keySignatures, clefs } = render('wrapped');
    expect(keySignatures).toBe(4);
    expect(clefs).toBe(4);
  });
  it('keeps scroll mode to one header on its single row', () => {
    const { keySignatures, clefs } = render('scroll');
    expect(keySignatures).toBe(1);
    expect(clefs).toBe(1);
  });
});
