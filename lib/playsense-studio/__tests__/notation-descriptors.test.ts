import { describe, expect, it } from 'vitest'
import { extractTrackEvents } from '../score-to-vexflow'
import { REFERENCE_EXCERPT_FIXTURE as F, GUITAR_LICK_FIXTURE } from '../score-fixtures'
import { VALUE_QN, type NoteValue } from '../rhythm'
import { parseScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization'
import type { Track } from '@/components/playsense-studio/shared/score-model/types'

const blocks = () => extractTrackEvents(F.tracks[0], F.initialTimeSignature, F.initialKeyFifths)

describe('richer descriptors', () => {
  it('the fixture is a valid score', () => {
    expect(() => parseScoreDocument(JSON.parse(JSON.stringify(F)))).not.toThrow()
  })
  it('carries dots, tuplets, marks and ids', () => {
    const [b1, b2, b3, b4, b5] = blocks()
    expect(b1.events[1]).toMatchObject({ id: 'n1', durationCode: '8', tuplet: { id: 't1', n: 3, m: 2 }, dynamic: 'mp', voice: 1 })
    expect(b3.events[1]).toMatchObject({ durationCode: '16', tuplet: { id: 't2', n: 5, m: 4 } })
    expect(b3.events[0].grace).toEqual([{ keys: ['c#/6'], accidentals: ['#'], slash: true }])
    expect(b3.events[6]).toMatchObject({ ornament: 'trill', articulations: ['fermata'] })
    expect(b4.events[0]).toMatchObject({ dots: 2, dotted: true, durationCode: 'q', text: 'dolce' })
    expect(b4.events[2].articulations).toEqual(['accent', 'tenuto'])
    expect(b5.events[0]).toMatchObject({ dots: 1, durationCode: 'h', dynamic: 'ff', articulations: ['marcato'] })
    expect(b2.events[3]).toMatchObject({ articulation: 'staccato', articulations: ['staccato'] }) // legacy field read through the accessor
  })
  it('applies the accidental rules and key changes', () => {
    const [b1, b2, b3, b4] = blocks()
    expect(b1.events[6]).toMatchObject({ keys: ['db/5'], accidentals: ['b'] })
    expect(b2.events[0]).toMatchObject({ keys: ['e/5'], accidentals: ['n'] })   // courtesy natural
    expect(b3).toMatchObject({ keyFifths: -1, keyChanged: true })
    expect(b3.events[4]).toMatchObject({ keys: ['bb/5'], accidentals: [null] })   // Bb5 is in F major
    expect(b4.events[0]).toMatchObject({ keys: ['b/4'], accidentals: ['n'] })     // B natural in F major
    expect(b4.keyChanged).toBe(false)
  })
  it('records the key in force before each bar', () => {
    const [b1, b2, b3, b4] = blocks()
    expect([b1, b2, b3, b4].map(b => [b.keyFifths, b.previousKeyFifths])).toEqual([[0, 0], [0, 0], [-1, 0], [-1, -1]])
  })
  it('splits voice 2 out and places rests per clef and voice', () => {
    const [, , , b4, b5] = blocks()
    expect(b4.events).toHaveLength(3)
    expect(b4.voice2Events.map(e => e.voice)).toEqual([2, 2])
    expect(b4.voice2Events[1]).toMatchObject({ isRest: true, keys: ['f/4'] })
    expect(b5).toMatchObject({ clef: 'bass', clefChanged: true })
  })
  it('groups legacy triplets without ids into runs of three', () => {
    const legacy: Track = { ...GUITAR_LICK_FIXTURE.tracks[0], measures: [{ number: 1, voices: [{ number: 1, events: [
      ...[60, 62, 64, 65, 67, 69].map(midi => ({ kind: 'note' as const, midi, durationQN: 1 / 3, triplet: true })),
      { kind: 'rest' as const, durationQN: 2 },
    ] }] }] }
    const ev = extractTrackEvents(legacy, [4, 4], 0)[0].events
    expect(ev[0].tuplet).toMatchObject({ n: 3, m: 2 })
    expect(ev[0].tuplet!.id).toBe(ev[2].tuplet!.id)
    expect(ev[3].tuplet!.id).not.toBe(ev[2].tuplet!.id)
    expect(ev[6].tuplet).toBeNull()
  })
  it('gives a legacy triplet run a fresh id after a gap, instead of reusing the first run\'s id', () => {
    // T T, rest, T T T — two runs of legacy (id-less) triplets separated by a
    // non-triplet event. The rest is sized to land the second run back on a
    // beat boundary (2.0), so it forms one clean group of three.
    const legacy: Track = { ...GUITAR_LICK_FIXTURE.tracks[0], measures: [{ number: 1, voices: [{ number: 1, events: [
      { kind: 'note' as const, midi: 60, durationQN: 1 / 3, triplet: true },
      { kind: 'note' as const, midi: 62, durationQN: 1 / 3, triplet: true },
      { kind: 'rest' as const, durationQN: 4 / 3 },
      { kind: 'note' as const, midi: 64, durationQN: 1 / 3, triplet: true },
      { kind: 'note' as const, midi: 65, durationQN: 1 / 3, triplet: true },
      { kind: 'note' as const, midi: 67, durationQN: 1 / 3, triplet: true },
    ] }] }] }
    const ev = extractTrackEvents(legacy, [4, 4], 0)[0].events
    expect(ev[0].tuplet!.id).toBe(ev[1].tuplet!.id)
    expect(ev[3].tuplet!.id).toBe(ev[4].tuplet!.id)
    expect(ev[4].tuplet!.id).toBe(ev[5].tuplet!.id)
    expect(ev[0].tuplet!.id).not.toBe(ev[3].tuplet!.id)
  })
  it('restates the accidental on a later untied note after a tie carries a sharp across the barline', () => {
    // C major. Bar 1 ends with F#4 tied into bar 2; bar 2 has the tied F#4, then another F#4.
    const track: Track = { ...GUITAR_LICK_FIXTURE.tracks[0], measures: [
      { number: 1, voices: [{ number: 1, events: [
        { kind: 'note', midi: 66, durationQN: 1, spelling: { step: 'F', alter: 1 }, tieToNext: true },
      ] }] },
      { number: 2, voices: [{ number: 1, events: [
        { kind: 'note', midi: 66, durationQN: 1, spelling: { step: 'F', alter: 1 } },
        { kind: 'note', midi: 66, durationQN: 1, spelling: { step: 'F', alter: 1 } },
      ] }] },
    ] }
    const [, b2] = extractTrackEvents(track, [4, 4], 0)
    expect(b2.events[0].accidentals).toEqual([null])
    expect(b2.events[1].accidentals).toEqual(['#'])
  })
  it('resets a voice\'s tie-carry memory when the voice has no events in a measure', () => {
    // Voice 2 carries a tie in bar 1, is absent in bar 2, then reappears untied in bar 3
    // with the same pitch. The gap must clear the tie memory, so bar 3 restates the sharp.
    const track: Track = { ...GUITAR_LICK_FIXTURE.tracks[0], measures: [
      { number: 1, voices: [
        { number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4 }] },
        { number: 2, events: [{ kind: 'note', midi: 66, durationQN: 4, spelling: { step: 'F', alter: 1 }, tieToNext: true }] },
      ] },
      { number: 2, voices: [
        { number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4 }] },
      ] },
      { number: 3, voices: [
        { number: 1, events: [{ kind: 'note', midi: 60, durationQN: 4 }] },
        { number: 2, events: [{ kind: 'note', midi: 66, durationQN: 4, spelling: { step: 'F', alter: 1 } }] },
      ] },
    ] }
    const [, , b3] = extractTrackEvents(track, [4, 4], 0)
    expect(b3.voice2Events[0].accidentals).toEqual(['#'])
  })
  it('treats an empty voice 2 as no second voice for rest placement', () => {
    const track: Track = { ...GUITAR_LICK_FIXTURE.tracks[0], measures: [
      { number: 1, voices: [
        { number: 1, events: [{ kind: 'rest', durationQN: 4 }] },
        { number: 2, events: [] },
      ] },
    ] }
    const [b1] = extractTrackEvents(track, [4, 4], 0)
    expect(b1.events[0].keys).toEqual(['b/4'])
  })
  it('leaves an old 4/4 score unchanged apart from the new fields', () => {
    const [b] = extractTrackEvents(GUITAR_LICK_FIXTURE.tracks[0], GUITAR_LICK_FIXTURE.initialTimeSignature, 0)
    expect(b.events.map(e => [e.keys, e.durationCode, e.dotted, e.triplet])).toMatchSnapshot()
    expect(b).toMatchObject({ clef: 'treble', keyFifths: 0, keyChanged: false, voice2Events: [] })
  })
})

describe('accidentals across both voices', () => {
  it('decides accidentals in time order across the voices, not voice 1 first', () => {
    // C major. Voice 2 has F#4 on beat 1; voice 1 has F#4 on beat 3.
    const track: Track = { ...GUITAR_LICK_FIXTURE.tracks[0], measures: [
      { number: 1, voices: [
        { number: 1, events: [
          { kind: 'note', midi: 72, durationQN: 2 },
          { kind: 'note', midi: 66, durationQN: 2 },
        ] },
        { number: 2, events: [{ kind: 'note', midi: 66, durationQN: 4 }] },
      ] },
    ] }
    const [b] = extractTrackEvents(track, [4, 4], 0)
    expect(b.voice2Events[0]).toMatchObject({ keys: ['f#/4'], accidentals: ['#'] })
    expect(b.events[1]).toMatchObject({ keys: ['f#/4'], accidentals: [null] })
  })
  it('lets voice 1 go first when both voices start together', () => {
    const track: Track = { ...GUITAR_LICK_FIXTURE.tracks[0], measures: [
      { number: 1, voices: [
        { number: 1, events: [{ kind: 'note', midi: 66, durationQN: 4 }] },
        { number: 2, events: [{ kind: 'note', midi: 66, durationQN: 4 }] },
      ] },
    ] }
    const [b] = extractTrackEvents(track, [4, 4], 0)
    expect(b.events[0].accidentals).toEqual(['#'])
    expect(b.voice2Events[0].accidentals).toEqual([null])
  })
})

describe('legacy triplet grouping by beat position', () => {
  // NoteValue tokens for id-less (legacy `triplet: true`, 3:2) events. A group
  // closes once the running sounding position within the bar lands on a
  // multiple of `unit` — the beat when the group's first written value is an
  // eighth or longer, half a beat otherwise — or once its sounding length
  // reaches 2 × unit, whichever comes first.
  const groupsOf = (values: NoteValue[]) => {
    const fill = 4 - values.reduce((a, v) => a + VALUE_QN[v] * 2 / 3, 0)
    const track: Track = { ...GUITAR_LICK_FIXTURE.tracks[0], measures: [{ number: 1, voices: [{ number: 1, events: [
      ...values.map(v => ({ kind: 'note' as const, midi: 60, durationQN: VALUE_QN[v] * 2 / 3, triplet: true })),
      ...(fill > 1e-9 ? [{ kind: 'rest' as const, durationQN: fill }] : []),
    ] }] }] }
    const ev = extractTrackEvents(track, [4, 4], 0)[0].events.slice(0, values.length)
    const out: NoteValue[][] = []
    ev.forEach((d, i) => {
      if (i > 0 && ev[i - 1].tuplet!.id === d.tuplet!.id) out[out.length - 1].push(values[i])
      else out.push([values[i]])
    })
    return out
  }
  it('keeps a group together until the beat, not a fixed count of the smallest value', () => {
    // [8,16,16,8] sums to one full beat — the old "3 × smallest" rule split this.
    expect(groupsOf(['8', '16', '16', '8'])).toEqual([['8', '16', '16', '8']])
    expect(groupsOf(['q', '8'])).toEqual([['q', '8']])
    expect(groupsOf(['q', 'q', 'q'])).toEqual([['q', 'q', 'q']])
    expect(groupsOf(['8', '8', '8', '8', '8', '8'])).toEqual([['8', '8', '8'], ['8', '8', '8']])
    expect(groupsOf(['16', '16', '16', '16', '16', '16'])).toEqual([['16', '16', '16'], ['16', '16', '16']])
  })
  it('starts a new group as soon as the previous one lands on the beat', () => {
    // q+8 fills exactly one beat, so the third event opens a fresh group.
    expect(groupsOf(['q', '8', '8'])).toEqual([['q', '8'], ['8']])
  })
  it('closes an open group at a non-triplet event', () => {
    const track: Track = { ...GUITAR_LICK_FIXTURE.tracks[0], measures: [{ number: 1, voices: [{ number: 1, events: [
      { kind: 'note' as const, midi: 60, durationQN: 2 / 3, triplet: true },
      { kind: 'note' as const, midi: 60, durationQN: 1 },
      { kind: 'note' as const, midi: 60, durationQN: 1 / 3, triplet: true },
    ] }] }] }
    const ev = extractTrackEvents(track, [4, 4], 0)[0].events
    expect(ev[1].tuplet).toBeNull()
    expect(ev[0].tuplet!.id).not.toBe(ev[2].tuplet!.id)
  })
})

describe('voice 2 of only rests', () => {
  it('does not trigger the two-voice layout', () => {
    const track: Track = { ...GUITAR_LICK_FIXTURE.tracks[0], measures: [
      { number: 1, voices: [
        { number: 1, events: [{ kind: 'rest', durationQN: 2 }, { kind: 'note', midi: 60, durationQN: 2 }] },
        { number: 2, events: [{ kind: 'rest', durationQN: 4 }] },
      ] },
    ] }
    const [b] = extractTrackEvents(track, [4, 4], 0)
    expect(b.events[0].keys).toEqual(['b/4'])
    expect(b.voice2Events).toEqual([])
  })
})

describe('percussion key signature', () => {
  it('never gives a percussion staff a key, even in a sharp key or after a key change', () => {
    const track: Track = {
      index: 0, instrument: 'perc-conga', displayName: 'Conga', tuning: null, stringMultiplicity: 1, channel: 9, defaultView: 'rhythm-grid',
      measures: [
        { number: 1, voices: [{ number: 1, events: [{ kind: 'note', midi: 65, durationQN: 4, percussion: { staffLine: 'e/5', notehead: 'normal' } }] }] },
        { number: 2, keyFifths: -3, voices: [{ number: 1, events: [{ kind: 'note', midi: 65, durationQN: 4, percussion: { staffLine: 'e/5', notehead: 'normal' } }] }] },
      ],
    }
    const blocks = extractTrackEvents(track, [4, 4], 2)
    expect(blocks.map(b => [b.keyFifths, b.keyChanged])).toEqual([[0, false], [0, false]])
  })
})
