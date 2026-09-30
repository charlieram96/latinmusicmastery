// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseMusicXmlString } from '../parsers/musicxml'

const doc = (measures: string) => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Violin</part-name></score-part></part-list>
<part id="P1">${measures}</part></score-partwise>`
const attrs = (div: number, beats = 3) => `<attributes><divisions>${div}</divisions><key><fifths>0</fifths></key><time><beats>${beats}</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`
const note = (o: { step: string; oct: number; type: string; dur: number; voice?: string; alter?: number; extra?: string; staff?: number }) =>
  `<note><pitch><step>${o.step}</step>${o.alter != null ? `<alter>${o.alter}</alter>` : ''}<octave>${o.oct}</octave></pitch><duration>${o.dur}</duration><voice>${o.voice ?? '1'}</voice><type>${o.type}</type>${o.extra ?? ''}${o.staff ? `<staff>${o.staff}</staff>` : ''}</note>`
const tm = (a: number, n: number) => `<time-modification><actual-notes>${a}</actual-notes><normal-notes>${n}</normal-notes></time-modification>`
const events = (xml: string, m = 0, v = 0) => parseMusicXmlString(doc(xml)).tracks[0].measures[m].voices[v].events

describe('MusicXML import — rhythm and voices', () => {
  it('reads triplet eighths as one 3:2 group of real length 1/3', () => {
    const ev = events(`<measure number="1">${attrs(6)}${note({ step: 'C', oct: 5, type: 'quarter', dur: 6 })}` +
      ['F', 'G', 'A'].map(s => note({ step: s, oct: 4, type: 'eighth', dur: 2, extra: tm(3, 2) })).join('') +
      `${note({ step: 'B', oct: 4, type: 'quarter', dur: 6 })}</measure>`)
    expect(ev.slice(1, 4).map(e => e.durationQN)).toEqual([1 / 3, 1 / 3, 1 / 3])
    expect(ev[1]).toMatchObject({ triplet: true, tuplet: { n: 3, m: 2 } })
    expect(new Set(ev.slice(1, 4).map(e => e.tuplet!.id)).size).toBe(1)
    expect(ev.reduce((s, e) => s + e.durationQN, 0)).toBeCloseTo(3, 9)
  })

  it('prefixes tuplet ids with the per-import token so two imports never share one', () => {
    const xml = `<measure number="1">${attrs(6)}` +
      ['F', 'G', 'A'].map(s => note({ step: s, oct: 4, type: 'eighth', dur: 2, extra: tm(3, 2) })).join('') +
      `${note({ step: 'B', oct: 4, type: 'half', dur: 12 })}</measure>`
    const [a, b] = [events(xml), events(xml)]
    expect(a[0].tuplet!.id.split('-')[0]).toBe(a[0].id!.split('-')[0])
    expect(a[0].tuplet!.id).not.toBe(b[0].tuplet!.id)
  })

  it('groups by counting when the exporter omits tuplet brackets, and starts a new group after n notes', () => {
    const six = ['C', 'D', 'E', 'F', 'G', 'A'].map(s => note({ step: s, oct: 5, type: 'eighth', dur: 2, extra: tm(3, 2) })).join('')
    const ev = events(`<measure number="1">${attrs(6)}${six}${note({ step: 'B', oct: 4, type: 'quarter', dur: 6 })}</measure>`)
    expect(ev[0].tuplet!.id).toBe(ev[2].tuplet!.id)
    expect(ev[3].tuplet!.id).not.toBe(ev[2].tuplet!.id)
  })

  it('keeps a mixed-value bracketed triplet as one group', () => {
    const start = '<notations><tuplet type="start"/></notations>', stop = '<notations><tuplet type="stop"/></notations>'
    const ev = events(`<measure number="1">${attrs(6)}${note({ step: 'C', oct: 5, type: 'quarter', dur: 4, extra: tm(3, 2) + start })}${note({ step: 'D', oct: 5, type: 'eighth', dur: 2, extra: tm(3, 2) + stop })}${note({ step: 'E', oct: 5, type: 'half', dur: 12 })}</measure>`)
    expect(ev[0].durationQN).toBeCloseTo(2 / 3, 9)
    expect(ev[0].tuplet!.id).toBe(ev[1].tuplet!.id)
  })

  it('reads a quintuplet and a double dot', () => {
    const q = ['E', 'D', 'C', 'B', 'A'].map(s => note({ step: s, oct: 5, type: '16th', dur: 4, extra: tm(5, 4) })).join('')
    const ev = events(`<measure number="1">${attrs(20)}${note({ step: 'D', oct: 6, type: 'quarter', dur: 35, extra: '<dot/><dot/>' })}${note({ step: 'C', oct: 6, type: '16th', dur: 5 })}</measure>`)
    expect(ev[0]).toMatchObject({ durationQN: 1.75, dots: 2 })
    expect(ev[0].dotted).toBeFalsy()
    const ev2 = events(`<measure number="1">${attrs(20)}${q}${note({ step: 'G', oct: 5, type: 'half', dur: 40 })}</measure>`)
    expect(ev2[0]).toMatchObject({ tuplet: { n: 5, m: 4 } })
    expect(ev2[0].durationQN).toBeCloseTo(0.2, 9)
    expect(ev2[0].triplet).toBeFalsy()
  })

  it('reads ties', () => {
    const ev = events(`<measure number="1">${attrs(4)}${note({ step: 'G', oct: 5, type: 'half', dur: 12, extra: '<dot/><tie type="start"/>' })}</measure>`)
    expect(ev[0]).toMatchObject({ tieToNext: true, dotted: true, durationQN: 3 })
  })

  it('splits a second voice using backup instead of appending it', () => {
    const score = parseMusicXmlString(doc(`<measure number="1">${attrs(4)}${note({ step: 'B', oct: 4, type: 'half', dur: 12, extra: '<dot/>' })}<backup><duration>12</duration></backup>` +
      ['G', 'G', 'G'].map(s => note({ step: s, oct: 4, type: 'quarter', dur: 4, voice: '2' })).join('') + `</measure>`))
    const m = score.tracks[0].measures[0]
    expect(m.voices).toHaveLength(2)
    expect(m.voices[0].events).toHaveLength(1)
    expect(m.voices[1]).toMatchObject({ number: 2 })
    expect(m.voices[1].events).toHaveLength(3)
  })

  it('ignores staff-2 forward and direction elements (piano-style two-staff part)', () => {
    const score = parseMusicXmlString(doc(
      `<measure number="1">${attrs(4)}` +
      note({ step: 'C', oct: 5, type: 'quarter', dur: 4, staff: 1 }) +
      `<forward><duration>4</duration><voice>1</voice><staff>2</staff></forward>` +
      `<direction placement="below"><direction-type><dynamics><f/></dynamics></direction-type><voice>1</voice><staff>2</staff></direction>` +
      note({ step: 'D', oct: 5, type: 'quarter', dur: 4, staff: 1 }) +
      `</measure>`
    ))
    const v = score.tracks[0].measures[0].voices
    expect(v).toHaveLength(1)
    expect(v[0].events.map(e => e.kind)).toEqual(['note', 'note'])
    expect(v[0].events[1].dynamic).toBeUndefined()
  })

  it('turns <forward> into a rest in that voice and ignores staff 2', () => {
    const score = parseMusicXmlString(doc(`<measure number="1">${attrs(4)}${note({ step: 'C', oct: 5, type: 'quarter', dur: 4, staff: 1 })}<forward><duration>8</duration><voice>1</voice></forward>${note({ step: 'C', oct: 3, type: 'half', dur: 8, staff: 2, voice: '5' })}</measure>`))
    const v = score.tracks[0].measures[0].voices
    expect(v).toHaveLength(1)
    expect(v[0].events.map(e => e.kind)).toEqual(['note', 'rest'])
    expect(v[0].events[1].durationQN).toBe(2)
  })

  it('keeps written spelling and courtesy accidentals', () => {
    const ev = events(`<measure number="1">${attrs(4)}${note({ step: 'B', oct: 4, alter: -1, type: 'quarter', dur: 4 })}${note({ step: 'E', oct: 5, type: 'quarter', dur: 4, extra: '<accidental cautionary="yes">natural</accidental>' })}${note({ step: 'F', oct: 5, alter: 2, type: 'quarter', dur: 4 })}</measure>`)
    expect(ev[0]).toMatchObject({ midi: 70, spelling: { step: 'B', alter: -1 } })
    expect(ev[1]).toMatchObject({ spelling: { step: 'E', alter: 0, showAccidental: 'always' } })
    expect(ev[2]).toMatchObject({ midi: 79, spelling: { step: 'F', alter: 2 } })
  })

  it('carries spelling, ties and rhythm onto pitched chord members', () => {
    const ev = events(`<measure number="1">${attrs(4)}${note({ step: 'B', oct: 4, alter: -1, type: 'quarter', dur: 4, extra: '<tie type="start"/>' })}${note({ step: 'D', oct: 5, type: 'quarter', dur: 4, extra: '<chord/><accidental cautionary="yes">natural</accidental>' })}</measure>`)
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({
      kind: 'chord',
      durationQN: 1,
      notes: [
        { midi: 70, spelling: { step: 'B', alter: -1 }, tieToNext: true },
        { midi: 74, spelling: { step: 'D', alter: 0, showAccidental: 'always' } },
      ],
    })

    // A tuplet on the chord's first note is a rhythm field: it belongs on the
    // Chord itself, not duplicated per member.
    const evT = events(`<measure number="1">${attrs(6)}${note({ step: 'C', oct: 5, type: 'eighth', dur: 2, extra: tm(3, 2) })}${note({ step: 'E', oct: 5, type: 'eighth', dur: 2, extra: tm(3, 2) + '<chord/>' })}${note({ step: 'F', oct: 4, type: 'quarter', dur: 4 })}</measure>`)
    expect(evT[0]).toMatchObject({ kind: 'chord', triplet: true, tuplet: { n: 3, m: 2 }, durationQN: 1 / 3 })
  })
})

describe('MusicXML import — marks', () => {
  const dir = (inner: string, voice = '1') => `<direction placement="below"><direction-type>${inner}</direction-type><voice>${voice}</voice></direction>`

  it('reads articulations, ornaments and fermatas', () => {
    const ev = events(`<measure number="1">${attrs(4)}` +
      note({ step: 'A', oct: 4, type: 'quarter', dur: 4, extra: '<notations><articulations><staccato/><accent/></articulations></notations>' }) +
      note({ step: 'B', oct: 4, type: 'quarter', dur: 4, extra: '<notations><articulations><strong-accent/><tenuto/></articulations><ornaments><trill-mark/></ornaments></notations>' }) +
      note({ step: 'C', oct: 5, type: 'quarter', dur: 4, extra: '<notations><fermata/><ornaments><inverted-mordent/></ornaments></notations>' }) + `</measure>`)
    expect(ev[0].articulations).toEqual(['staccato', 'accent'])
    expect(ev[1]).toMatchObject({ articulations: ['marcato', 'tenuto'], ornament: 'trill' })
    expect(ev[2]).toMatchObject({ articulations: ['fermata'], ornament: 'mordent' })
  })

  it('attaches grace notes to the next note without taking time', () => {
    const grace = `<note><grace slash="yes"/><pitch><step>C</step><alter>1</alter><octave>6</octave></pitch><voice>1</voice><type>eighth</type></note>`
    const ev = events(`<measure number="1">${attrs(4)}${grace}${note({ step: 'D', oct: 6, type: 'half', dur: 8, extra: '<dot/>' })}</measure>`)
    expect(ev).toHaveLength(1)
    expect(ev[0].grace).toEqual([{ midi: 85, spelling: { step: 'C', alter: 1 }, slash: true }])
  })

  it('puts dynamics and words on the next note of their voice', () => {
    const ev = events(`<measure number="1">${attrs(4)}${dir('<dynamics><mp/></dynamics>')}${dir('<words>div.</words>')}${note({ step: 'B', oct: 4, type: 'half', dur: 8 })}${note({ step: 'D', oct: 5, type: 'quarter', dur: 4 })}</measure>`)
    expect(ev[0]).toMatchObject({ dynamic: 'mp', text: 'div.' })
    expect(ev[1].dynamic).toBeUndefined()
  })

  it('turns wedges and slurs into spans between event ids, across barlines', () => {
    const score = parseMusicXmlString(doc(
      `<measure number="1">${attrs(4)}${dir('<wedge type="crescendo"/>')}${note({ step: 'F', oct: 4, type: 'quarter', dur: 4, extra: '<notations><slur type="start" number="1"/></notations>' })}${note({ step: 'G', oct: 4, type: 'half', dur: 8 })}${dir('<wedge type="stop"/>')}</measure>` +
      `<measure number="2">${note({ step: 'A', oct: 4, type: 'half', dur: 12, extra: '<dot/><notations><slur type="stop" number="1"/></notations>' })}</measure>`))
    const [m1, m2] = score.tracks[0].measures
    const [f, g] = m1.voices[0].events
    const a = m2.voices[0].events[0]
    expect(f.id && g.id && a.id).toBeTruthy()
    expect(score.spans).toEqual(expect.arrayContaining([
      expect.objectContaining({ type: 'cresc', from: f.id, to: g.id }),
      expect.objectContaining({ type: 'slur', from: f.id, to: a.id }),
    ]))
  })

  it('carries a trailing direction across the barline to the next note', () => {
    const score = parseMusicXmlString(doc(
      `<measure number="1">${attrs(4)}${note({ step: 'F', oct: 4, type: 'quarter', dur: 4 })}${note({ step: 'G', oct: 4, type: 'quarter', dur: 4 })}${dir('<dynamics><mf/></dynamics>')}</measure>` +
      `<measure number="2">${note({ step: 'A', oct: 4, type: 'quarter', dur: 4 })}</measure>`))
    const [m1, m2] = score.tracks[0].measures
    expect(m1.voices[0].events.every(e => e.dynamic === undefined)).toBe(true)
    expect(m2.voices[0].events[0].dynamic).toBe('mf')
  })

  it('closes an unmatched wedge stop instead of leaving it open for a later note', () => {
    // A second, real <wedge type="stop"/> after the two notes is what actually
    // exercises the bug: with the fix, openWedge is cleared at the first
    // (unmatched) stop, so this later stop has nothing to close. Left buggy,
    // openWedge stays alive, the first of the two notes wrongly becomes its
    // "from", and this later stop would wrongly emit a cresc span between them.
    const score = parseMusicXmlString(doc(
      `<measure number="1">${attrs(4)}${dir('<wedge type="crescendo"/>')}<note><rest/><duration>4</duration><voice>1</voice><type>quarter</type></note>${dir('<wedge type="stop"/>')}${note({ step: 'C', oct: 5, type: 'quarter', dur: 4 })}${note({ step: 'D', oct: 5, type: 'quarter', dur: 4 })}${dir('<wedge type="stop"/>')}</measure>`))
    expect((score.spans ?? []).some(s => s.type === 'cresc')).toBe(false)
  })

  it('produces a document that parseScoreDocument accepts', async () => {
    const { parseScoreDocument } = await import('@/components/playsense-studio/shared/score-model/serialization')
    const score = parseMusicXmlString(doc(`<measure number="1">${attrs(4)}${dir('<dynamics><f/></dynamics>')}${note({ step: 'E', oct: 5, type: 'quarter', dur: 4, extra: '<notations><slur type="start"/></notations>' })}${note({ step: 'G', oct: 5, type: 'half', dur: 8, extra: '<notations><slur type="stop"/></notations>' })}</measure>`))
    expect(() => parseScoreDocument(JSON.parse(JSON.stringify(score)))).not.toThrow()
  })

  it('caps grace notes at 4 and omits out-of-range tuplets so the import always validates', async () => {
    const { parseScoreDocument } = await import('@/components/playsense-studio/shared/score-model/serialization')
    const grace = (step: string) => `<note><grace/><pitch><step>${step}</step><octave>6</octave></pitch><voice>1</voice><type>eighth</type></note>`
    const sixGraces = ['C', 'D', 'E', 'F', 'G', 'A'].map(grace).join('')
    const score = parseMusicXmlString(doc(
      `<measure number="1">${attrs(4)}${sixGraces}${note({ step: 'B', oct: 6, type: 'quarter', dur: 4 })}` +
      note({ step: 'C', oct: 5, type: '64th', dur: 1, extra: tm(17, 16) }) +
      `${note({ step: 'D', oct: 5, type: '64th', dur: 1, extra: tm(17, 16) })}</measure>`
    ))
    const ev = score.tracks[0].measures[0].voices[0].events
    expect(ev[0].grace).toHaveLength(4)
    const outOfRange = ev.slice(1)
    for (const e of outOfRange) {
      expect(e.tuplet).toBeUndefined()
      expect(e.triplet).toBeUndefined()
      expect(e.durationQN).toBeCloseTo((1 / 16) * (16 / 17), 9)
    }
    expect(() => parseScoreDocument(JSON.parse(JSON.stringify(score)))).not.toThrow()
  })

  it('de-duplicates articulations read from a note', () => {
    const ev = events(`<measure number="1">${attrs(4)}` +
      note({ step: 'A', oct: 4, type: 'quarter', dur: 4, extra: '<notations><articulations><staccato/><staccato/><accent/></articulations></notations>' }) +
      `</measure>`)
    expect(ev[0].articulations).toEqual(['staccato', 'accent'])
  })
})

describe('MusicXML import — event id uniqueness across imports', () => {
  it('gives two imports of the same document disjoint id sets', () => {
    const xml = doc(`<measure number="1">${attrs(4)}${note({ step: 'C', oct: 5, type: 'quarter', dur: 4 })}${note({ step: 'D', oct: 5, type: 'quarter', dur: 4 })}</measure>`)
    const score1 = parseMusicXmlString(xml)
    const score2 = parseMusicXmlString(xml)
    const ids1 = score1.tracks[0].measures[0].voices[0].events.map(e => e.id)
    const ids2 = score2.tracks[0].measures[0].voices[0].events.map(e => e.id)
    expect(ids1.every(id => !!id)).toBe(true)
    expect(ids2.every(id => !!id)).toBe(true)
    expect(ids1.some(id => ids2.includes(id))).toBe(false)
  })
})

describe('published score metadata', () => {
  it('imports the composer and uses LMM when one was not provided', () => {
    const xml=doc(`<measure number="1">${attrs(1)}</measure>`)
    expect(parseMusicXmlString(xml).composer).toBe('LMM')
    const withAuthor=xml.replace('<part-list>', '<identification><creator type="composer">Mauricio Upmann</creator></identification><part-list>')
    expect(parseMusicXmlString(withAuthor).composer).toBe('Mauricio Upmann')
  })
})
