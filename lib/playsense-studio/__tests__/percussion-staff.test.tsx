// @vitest-environment jsdom
import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { teachingStrokeNotation, teachingNoteDuration, percussionStaffAt } from '../percussion-staff'
import { variacionesStaff } from '../variaciones-staff'
import { PercussionStaff } from '@/components/playsense-studio/shared/percussion-staff-cue'
import { lessonPresentationFor } from '../lesson-presentation'
import { VARIACIONES_SOURCE_PATH } from '../variaciones-presentation'

it('covers all 32 final demonstration bars with ordered recorded attacks and no narration clicks', () => {
  expect(variacionesStaff).toHaveLength(33)
  for (const [i,cue] of variacionesStaff.entries()) {
    expect(cue.slots).toHaveLength(cue.closing ? 1 : 8)
    if (i) expect(cue.start).toBe(variacionesStaff[i-1].end)
    for (const [j,hit] of cue.slots.entries()) {
      expect(hit.at).toBeGreaterThanOrEqual(cue.start)
      expect(hit.at).toBeLessThan(cue.end)
      if (j) expect(hit.at).toBeGreaterThan(cue.slots[j-1].at)
    }
  }
  expect(percussionStaffAt(variacionesStaff,296)).toBeNull()
  expect(percussionStaffAt(variacionesStaff,375)).toBeNull()
  expect(lessonPresentationFor(VARIACIONES_SOURCE_PATH,true)?.percussionStaff).toBe(variacionesStaff)
})
it('follows seeks across Sobao, shell fill, return to Sobao and the final fill', () => {
  for (const [time,section] of [[298,'sobao'],[320,'cascara'],[339,'sobao'],[373,'cascara'],[298,'sobao']] as const) {
    expect(percussionStaffAt(variacionesStaff,time)?.cue.section).toBe(section)
  }
  const paused = percussionStaffAt(variacionesStaff,299.21)
  expect(percussionStaffAt(variacionesStaff,299.21)).toEqual(paused)
  expect(paused?.cue.slots[paused.slot].left).toBe('open')
})
it('renders the official circled cross and hollow slashed oval on five staff lines, in both languages', () => {
  for (const lang of ['es','en'] as const) {
    const host=document.createElement('div')
    host.innerHTML=renderToStaticMarkup(<PercussionStaff cue={variacionesStaff[0]} slot={1} lang={lang} />)
    expect(host.querySelectorAll('line')).toHaveLength(5)
    const muted=host.querySelector('[data-hand="left"] [data-stroke="muted"]')!
    expect(muted.querySelector('circle')).not.toBeNull()
    expect(muted.querySelector('path')).not.toBeNull()
    const open=host.querySelector('[data-hand="left"] [data-stroke="open"]')!
    expect(open.querySelector('ellipse')).not.toBeNull()
    expect(open.querySelector('path')).not.toBeNull()
    expect(host.querySelector('[data-hand="left"] [data-active] [data-stroke]')?.getAttribute('data-stroke')).toBe('muted')
  }
})

it('uses the official timbal shell head and the requested spaces, regardless of hand', () => {
  for (const hand of ['right','left'] as const) {
    expect(teachingStrokeNotation('cascara',hand)).toEqual({staffLine:'a/4',y:125,notehead:'plus'})
    expect(teachingStrokeNotation('muted',hand)).toEqual({staffLine:'f/4',y:135,notehead:'circle-x'})
    expect(teachingStrokeNotation('open',hand)).toEqual({staffLine:'f/4',y:135,notehead:'slashed-open'})
  }
})
it('renders the opening quarters without flags or a following eighth rest, retaining left-hand strokes', () => {
  for (const cue of variacionesStaff.filter(c=>c.bar===1 && (c.section==='sobao'||c.closing))) {
    const host=document.createElement('div')
    host.innerHTML=renderToStaticMarkup(<PercussionStaff cue={cue} slot={0} lang="es" />)
    const opening=host.querySelector('[data-hand="right"] [data-slot="0"]')!
    expect(opening.getAttribute('data-duration')).toBe('1')
    expect(opening.querySelector('[data-flag],[data-beam]')).toBeNull()
    expect(host.querySelector('[data-hand="right"] [data-slot="1"]')).toBeNull()
    if (cue.slots[1]?.left) expect(host.querySelector('[data-hand="left"] [data-slot="1"] [data-stroke]')).not.toBeNull()
  }
  expect(teachingNoteDuration(variacionesStaff[1],0,'right')).toBe(1)
  const ending=percussionStaffAt(variacionesStaff,374.3)!
  expect(ending.cue.closing).toBe(true)
  expect(ending.cue.slots[ending.slot]).toMatchObject({right:'cascara',left:null})
})

it('copies both bars of the original right-hand rhythm, retaining its second-bar rest', () => {
  for (const [bar, expected] of [[0,[1,1,.5,1,.5]],[1,[1,.5,.5,1,.5]]] as const) {
    const cue=variacionesStaff[bar]
    expect(cue.slots.flatMap((hit,i)=>hit.right ? [teachingNoteDuration(cue,i,'right')] : [])).toEqual(expected)
    const host=document.createElement('div')
    host.innerHTML=renderToStaticMarkup(<PercussionStaff cue={cue} slot={0} lang="es" />)
    for (const i of bar===0 ? [1,3,6] : [1,6]) expect(host.querySelector(`[data-hand="right"] [data-slot="${i}"]`)).toBeNull()
    if (bar===1) expect(host.querySelector('[data-hand="right"] [data-slot="4"]')).not.toBeNull()
  }
})

it('combines only empty left-hand beat pairs into quarter rests, preserving every Sobao attack', () => {
  for (const cue of variacionesStaff.filter(c=>!c.closing && c.section==='sobao')) {
    const host=document.createElement('div')
    host.innerHTML=renderToStaticMarkup(<PercussionStaff cue={cue} slot={0} lang="es" />)
    for (let i=0;i<8;i+=2) {
      const pair=cue.slots.slice(i,i+2)
      if (pair.every(hit=>hit.left===null)) {
        expect(host.querySelector(`[data-hand="left"] [data-slot="${i}"] [data-quarter-rest]`)).not.toBeNull()
        expect(host.querySelector(`[data-hand="left"] [data-slot="${i+1}"]`)).toBeNull()
      }
    }
    for (const [i,hit] of cue.slots.entries()) if (hit.left) {
      expect(host.querySelector(`[data-hand="left"] [data-slot="${i}"] [data-stroke]`)?.getAttribute('data-stroke')).toBe(hit.left)
    }
  }
})

it('uses official rimshot and low open drum for all transitions, both eighths', () => {
  expect(teachingStrokeNotation('rim','right')).toEqual({staffLine:'a/4',y:125,notehead:'x'})
  expect(teachingStrokeNotation('tom','left')).toEqual({staffLine:'f/4',y:135,notehead:'normal'})
  const calls=variacionesStaff.filter(c=>c.call)
  expect(calls).toHaveLength(3)
  for (const cue of calls) {
    expect(cue.slots[5].right).toBe('rim')
    expect(cue.slots[6].left).toBe('tom')
    expect(teachingNoteDuration(cue,5,'right')).toBe(.5)
    expect(teachingNoteDuration(cue,6,'left')).toBe(.5)
  }
})
it('matches the eight eighth notes and high/low shell positions of Relleno Mano Izq Cascara', () => {
  for (const cue of variacionesStaff.filter(c=>c.section==='cascara'&&!c.call&&!c.closing)) {
    const expected=cue.bar===1 ? ['R','L','R','L','R','R','L','R'] : ['R','L','R','R','L','R','L','R']
    expect(cue.slots.map(hit=>hit.right ? 'R' : 'L')).toEqual(expected)
    for (const [i,hit] of cue.slots.entries()) {
      const hand=hit.right?'right':'left',kind=hit[hand]!
      expect(teachingStrokeNotation(kind,hand).staffLine).toBe(hand==='right'?'a/4':'f/4')
      expect(teachingNoteDuration(cue,i,hand)).toBe(.5)
    }
  }
})

it('beams the fill in two groups of four across both hands, like the supplied MXL', () => {
  for (const cue of variacionesStaff.filter(c=>c.section==='cascara'&&!c.call&&!c.closing)) {
    const host=document.createElement('div')
    host.innerHTML=renderToStaticMarkup(<PercussionStaff cue={cue} slot={1} lang="es" />)
    expect(host.querySelectorAll('[data-voice="joined"] [data-stem="up"]')).toHaveLength(8)
    expect(host.querySelectorAll('[data-beam]')).toHaveLength(6)
    expect(host.querySelectorAll('[data-rest],[data-flag]')).toHaveLength(0)
  }
})
it('keeps Sobao separate and lowers its eighth rests to the quarter-rest row', () => {
  const host=document.createElement('div')
  host.innerHTML=renderToStaticMarkup(<PercussionStaff cue={variacionesStaff[1]} slot={1} lang="es" />)
  expect(host.querySelector('[data-voice="joined"]')).toBeNull()
  for (const rest of host.querySelectorAll('[data-hand="left"] [data-eighth-rest]')) expect(rest.getAttribute('transform')).toBe('translate(0 20)')
})

it('keeps every orange Sobao rest above the notes and every blue rest below through the final section', () => {
  for (const cue of variacionesStaff.filter(c=>c.section==='sobao')) {
    const host=document.createElement('div')
    host.innerHTML=renderToStaticMarkup(<PercussionStaff cue={cue} slot={-1} lang="es" />)
    for (const rest of host.querySelectorAll('[data-hand="right"] [data-eighth-rest]')) {
      expect(rest.getAttribute('transform')).toBe('translate(0 -20)')
      expect(rest.getAttribute('fill')).toBe('#ffac3c')
    }
    for (const rest of host.querySelectorAll('[data-hand="left"] [data-eighth-rest], [data-hand="left"] [data-quarter-rest]')) {
      expect(rest.getAttribute('transform')).toBe('translate(0 20)')
      expect(rest.getAttribute('fill')).toBe('#9ae9ff')
    }
  }
})

it('groups the final right-hand rests at 5:15 but retains the instructor-confirmed final rimshot at 5:54', () => {
  const first=percussionStaffAt(variacionesStaff,315)!.cue
  const last=percussionStaffAt(variacionesStaff,354.7)!.cue
  const host=document.createElement('div')
  host.innerHTML=renderToStaticMarkup(<PercussionStaff cue={first} slot={4} lang="es" />)
  const rest=host.querySelector('[data-hand="right"] [data-slot="6"]')!
  expect(rest.getAttribute('data-duration')).toBe('1')
  expect(rest.querySelector('[data-quarter-rest]')?.getAttribute('transform')).toBe('translate(0 -20)')
  expect(host.querySelector('[data-hand="right"] [data-slot="7"]')).toBeNull()
  expect(last.slots[7]).toEqual({at:354.683,right:'rim',left:null})
  host.innerHTML=renderToStaticMarkup(<PercussionStaff cue={last} slot={7} lang="es" />)
  expect(host.querySelector('[data-hand="right"] [data-slot="6"] [data-eighth-rest]')).not.toBeNull()
  expect(host.querySelector('[data-hand="right"] [data-slot="7"] [data-notehead="x"]')).not.toBeNull()
})
