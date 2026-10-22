// @vitest-environment jsdom
import {expect,it} from 'vitest'
import {parseMusicXmlString} from '../parsers/musicxml'
import {writeMusicXml} from '../export/musicxml-writer'
import {walkMeasures,trackDurationQN} from '../time-mapping'
import {extractTrackEvents} from '../score-to-vexflow'
import {staveHeader} from '../notation/build-measure'
const wrap=(m:string)=>`<score-partwise><part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">${m}</part></score-partwise>`
const note=(duration:number)=>`<note><pitch><step>C</step><octave>4</octave></pitch><duration>${duration}</duration><type>${duration===4?'whole':'quarter'}</type></note>`
it('retains unmetered duration and omits a fictitious 4/4 header',()=>{
 const score=parseMusicXmlString(wrap(`<measure number="1"><attributes><divisions>1</divisions><time><senza-misura/></time></attributes>${note(4).repeat(5)}</measure><measure number="2">${note(4)}</measure>`));
 const track=score.tracks[0];expect(trackDurationQN(track,score)).toBe(24)
 const blocks=extractTrackEvents(track,score.initialTimeSignature);expect(blocks[1].cumulativeQN).toBe(20)
 expect(staveHeader(blocks[0],{opening:true,rowStart:true}).time).toBeUndefined()
 expect(writeMusicXml(score,[0])).toContain('<senza-misura/>')
})
it('keeps a one-quarter pickup before a full 4/4 bar through export',()=>{
 const score=parseMusicXmlString(wrap(`<measure number="0" implicit="yes"><attributes><divisions>1</divisions><time><beats>4</beats><beat-type>4</beat-type></time></attributes>${note(1)}</measure><measure number="1">${note(4)}</measure>`));
 const track=score.tracks[0];expect(track.measures[0].durationQN).toBe(1);expect([...walkMeasures(track,score)][1].state.cumulativeQN).toBe(1);expect(trackDurationQN(track,score)).toBe(5)
 const restored=parseMusicXmlString(writeMusicXml(score,[0]));expect(restored.tracks[0].measures[0].durationQN).toBe(1)
})
