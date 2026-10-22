// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { parseMusicXmlString } from '../parsers/musicxml'
import { writeMusicXml } from '../export/musicxml-writer'
import { parseScoreDocument, serializeScoreDocument } from '@/components/playsense-studio/shared/score-model/serialization'
import { soundingQN, writtenValue } from '../rhythm'
import { vexflowDurationCode } from '../score-to-vexflow'

it('preserves three augmentation dots through import, storage, rendering and export',()=>{
 const score=parseMusicXmlString(`<score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1"><measure number="1"><attributes><divisions>8</divisions><time><beats>2</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes><note><pitch><step>E</step><octave>4</octave></pitch><duration>15</duration><type>quarter</type><dot/><dot/><dot/></note><note><pitch><step>F</step><octave>4</octave></pitch><duration>1</duration><type>32nd</type></note></measure></part></score-partwise>`)
 const stored=parseScoreDocument(serializeScoreDocument(score))
 const e=stored.tracks[0].measures[0].voices[0].events[0]
 expect(e).toMatchObject({durationQN:1.875,dots:3})
 expect(soundingQN('q',3)).toBe(1.875)
 expect(writtenValue(e)).toBe('q')
 expect(vexflowDurationCode(e.durationQN,3)).toBe('q')
 const output=writeMusicXml(stored,[0]);expect(output.match(/<dot\s*\/>/g)).toHaveLength(3)
 expect(parseMusicXmlString(output).tracks[0].measures[0].voices[0].events[0]).toMatchObject({durationQN:1.875,dots:3})
})
