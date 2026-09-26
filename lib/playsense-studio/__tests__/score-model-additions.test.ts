import { describe, expect, it } from 'vitest'
import { parseScoreDocument, ScoreDocumentValidationError } from '@/components/playsense-studio/shared/score-model/serialization'
import type { MusicalEvent, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'
import {
  ensureEventIds, eventArticulations, eventDots, eventSpelling, eventTuplet, parseSpellingHint, tupletScale,
} from '@/components/playsense-studio/shared/score-model/accessors'

function score(events: MusicalEvent[], extra: Partial<ScoreDocument> = {}): ScoreDocument {
  return {
    schemaVersion: 1, title: 'T', sourceFormat: 'native', initialTempo: 96, initialTimeSignature: [3, 4], initialKeyFifths: 0,
    tracks: [{ index: 0, instrument: 'staff', displayName: 'Violin', tuning: null, stringMultiplicity: 1, channel: null, defaultView: 'staff',
      measures: [{ number: 1, voices: [{ number: 1, events }] }] }],
    ...extra,
  }
}

describe('score model additions', () => {
  it('round-trips every new field through parseScoreDocument', () => {
    const input = score([
      { kind: 'note', id: 'a', midi: 71, durationQN: 1.75, dots: 2, articulations: ['staccato', 'fermata'], ornament: 'trill', dynamic: 'mp', text: 'dolce',
        grace: [{ midi: 73, slash: true }], spelling: { step: 'B', alter: 0, showAccidental: 'always' } },
      { kind: 'note', id: 'b', midi: 76, durationQN: 0.2, tuplet: { id: 't1', n: 5, m: 4 } },
      { kind: 'chord', id: 'c', durationQN: 1.05, notes: [{ midi: 64, spelling: { step: 'E', alter: 0 } }, { midi: 67 }] },
    ], { spans: [{ id: 's1', type: 'slur', from: 'a', to: 'b' }, { id: 's2', type: 'cresc', from: 'a', to: 'c' }] })
    input.tracks[0].measures[0] = { ...input.tracks[0].measures[0], clef: 'alto', repeatStart: true, repeatEnd: true, volta: '1.', endBarline: 'double' }
    expect(parseScoreDocument(JSON.parse(JSON.stringify(input)))).toEqual(input)
  })

  it('rejects malformed new fields instead of passing them to the renderer', () => {
    expect(() => parseScoreDocument(score([{ kind: 'note', midi: 60, durationQN: 1, tuplet: { id: 't', n: 1, m: 1 } }]))).toThrow(ScoreDocumentValidationError)
    expect(() => parseScoreDocument(score([{ kind: 'note', midi: 60, durationQN: 1, dynamic: 'loud' as never }]))).toThrow(ScoreDocumentValidationError)
    expect(() => parseScoreDocument(score([{ kind: 'note', midi: 60, durationQN: 1, dots: 3 as never }]))).toThrow(ScoreDocumentValidationError)
  })

  it('reads legacy fields through the accessors', () => {
    const legacy: MusicalEvent = { kind: 'note', midi: 60, durationQN: 1 / 3, dotted: false, triplet: true, articulation: 'accent', spellingHint: 'Bb' }
    expect(eventDots({ kind: 'rest', durationQN: 1.5, dotted: true })).toBe(1)
    expect(eventTuplet(legacy)).toEqual({ n: 3, m: 2 })
    expect(tupletScale(legacy)).toBeCloseTo(2 / 3, 12)
    expect(eventArticulations(legacy)).toEqual(['accent'])
    expect(eventSpelling(legacy as { spellingHint?: string })).toEqual({ step: 'B', alter: -1 })
  })

  it('prefers new fields over legacy ones', () => {
    const both: MusicalEvent = { kind: 'note', midi: 60, durationQN: 1.75, dotted: true, dots: 2, triplet: true, tuplet: { id: 'x', n: 5, m: 4 }, articulation: 'accent', articulations: ['tenuto'] }
    expect(eventDots(both)).toBe(2)
    expect(eventTuplet(both)).toEqual({ id: 'x', n: 5, m: 4 })
    expect(eventArticulations(both)).toEqual(['tenuto'])
  })

  it('parses spelling hints', () => {
    expect(parseSpellingHint('C#')).toEqual({ step: 'C', alter: 1 })
    expect(parseSpellingHint('ebb')).toEqual({ step: 'E', alter: -2 })
    expect(parseSpellingHint('Fx')).toEqual({ step: 'F', alter: 2 })
    expect(parseSpellingHint('H')).toBeNull()
    expect(parseSpellingHint(undefined)).toBeNull()
  })

  it('assigns missing event ids without mutating or touching existing ones', () => {
    const input = score([{ kind: 'note', id: 'keep', midi: 60, durationQN: 1 }, { kind: 'rest', durationQN: 2 }])
    const before = JSON.stringify(input)
    let n = 0
    const out = ensureEventIds(input, () => `new${++n}`)
    expect(JSON.stringify(input)).toBe(before)
    expect(out.tracks[0].measures[0].voices[0].events.map(e => e.id)).toEqual(['keep', 'new1'])
    expect(ensureEventIds(out, () => 'never')).toBe(out)
  })
})
