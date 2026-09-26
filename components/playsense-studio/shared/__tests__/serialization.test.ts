import { describe, expect, it } from 'vitest';
import {
  parseScoreDocument,
  serializeScoreDocument,
  ScoreDocumentValidationError,
} from '../score-model/serialization';
import {
  CONGA_TUMBAO_FIXTURE,
  GUITAR_LICK_FIXTURE,
  SON_MONTUNO_FIXTURE,
} from '@/lib/playsense-studio/score-fixtures';

describe('parseScoreDocument — fixtures round-trip', () => {
  it('GUITAR_LICK_FIXTURE parses and re-serializes', () => {
    const parsed = parseScoreDocument(serializeScoreDocument(GUITAR_LICK_FIXTURE));
    expect(parsed.title).toBe('C Major Scale Ascending');
    expect(parsed.tracks).toHaveLength(1);
    expect(parsed.tracks[0].measures).toHaveLength(2);
  });

  it('CONGA_TUMBAO_FIXTURE parses with rhythm-grid default view', () => {
    const parsed = parseScoreDocument(serializeScoreDocument(CONGA_TUMBAO_FIXTURE));
    expect(parsed.tracks[0].defaultView).toBe('rhythm-grid');
    expect(parsed.tracks[0].instrument).toBe('perc-conga');
  });

  it('SON_MONTUNO_FIXTURE parses with multiple tracks and tempo change', () => {
    const parsed = parseScoreDocument(serializeScoreDocument(SON_MONTUNO_FIXTURE));
    expect(parsed.tracks).toHaveLength(3);
    expect(parsed.tracks[0].measures[2].tempoChange).toBe(110);
  });
});

describe('parseScoreDocument — rejection paths', () => {
  it('rejects unknown schemaVersion', () => {
    const badPayload = { ...GUITAR_LICK_FIXTURE, schemaVersion: 99 };
    expect(() => parseScoreDocument(badPayload)).toThrow(ScoreDocumentValidationError);
  });

  it('rejects negative tempo', () => {
    const bad = serializeScoreDocument({
      ...GUITAR_LICK_FIXTURE,
      initialTempo: -120,
    } as never);
    expect(() => parseScoreDocument(bad)).toThrow(ScoreDocumentValidationError);
  });

  it('rejects MIDI out of range', () => {
    const bad = JSON.parse(
      JSON.stringify(GUITAR_LICK_FIXTURE)
    );
    bad.tracks[0].measures[0].voices[0].events[0].midi = 200;
    expect(() => parseScoreDocument(bad)).toThrow(ScoreDocumentValidationError);
  });

  it('rejects empty tracks array', () => {
    const bad = { ...GUITAR_LICK_FIXTURE, tracks: [] };
    expect(() => parseScoreDocument(bad)).toThrow(ScoreDocumentValidationError);
  });

  it('rejects empty voices in a measure', () => {
    const bad = JSON.parse(JSON.stringify(GUITAR_LICK_FIXTURE));
    bad.tracks[0].measures[0].voices = [];
    expect(() => parseScoreDocument(bad)).toThrow(ScoreDocumentValidationError);
  });

  it('rejects key signature outside [-7, 7]', () => {
    const bad = { ...GUITAR_LICK_FIXTURE, initialKeyFifths: 8 };
    expect(() => parseScoreDocument(bad)).toThrow(ScoreDocumentValidationError);
  });
});

describe('parseScoreDocument — discriminated union', () => {
  it('accepts a chord event with ≥2 notes', () => {
    const parsed = parseScoreDocument(serializeScoreDocument(SON_MONTUNO_FIXTURE));
    const firstEvent = parsed.tracks[0].measures[0].voices[0].events[0];
    expect(firstEvent.kind).toBe('chord');
  });

  it('rejects chord events with only 1 note', () => {
    const bad = JSON.parse(JSON.stringify(SON_MONTUNO_FIXTURE));
    bad.tracks[0].measures[0].voices[0].events[0].notes = [{ midi: 60 }];
    expect(() => parseScoreDocument(bad)).toThrow(ScoreDocumentValidationError);
  });
});

describe('parseScoreDocument — measure end barline', () => {
  it('round-trips an explicit endBarline and rejects unknown values', () => {
    const base = serializeScoreDocument(GUITAR_LICK_FIXTURE) as { tracks: Array<{ measures: Array<Record<string, unknown>> }> };
    base.tracks[0].measures[1].endBarline = 'single';
    expect(parseScoreDocument(base).tracks[0].measures[1].endBarline).toBe('single');
    base.tracks[0].measures[1].endBarline = 'double';
    expect(parseScoreDocument(base).tracks[0].measures[1].endBarline).toBe('double');
    base.tracks[0].measures[1].endBarline = 'unknown';
    expect(() => parseScoreDocument(base)).toThrow(ScoreDocumentValidationError);
  });
});

describe('parseScoreDocument — tempoMarksConfirmed', () => {
  it('round-trips the flag', () => {
    const parsed = parseScoreDocument({
      ...serializeScoreDocument(GUITAR_LICK_FIXTURE) as object,
      tempoMarksConfirmed: true,
    });
    expect(parsed.tempoMarksConfirmed).toBe(true);
  });
});
