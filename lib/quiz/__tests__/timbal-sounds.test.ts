import { expect, it } from 'vitest'
import { TIMBAL_KEYS, timbalSoundKind, timbalSoundUrl } from '../timbal-sounds'

it('keeps the hand bell keyboard binding and sound available in both languages', () => {
  for (const label of ['Hand Bell', 'Handbell', 'Campana de mano', 'Campana de bongó']) {
    const kind = timbalSoundKind(label)
    expect(kind).toBe('hand-bell')
    expect(TIMBAL_KEYS.find(binding => binding.kind === kind)?.key).toBe('F')
    expect(timbalSoundUrl(kind!, .5, .5)).toBe('/audio/quiz-timbal/hand-bell.wav')
  }
})

it('maps the supplied sounds and leaves silent hardware unassigned', () => {
  expect(['High Timbale','Low Timbale','Contra Campana','Hand Bell','Bell Cha','Jamblock','Cymbal and Stand','Bracket'].map(timbalSoundKind))
    .toEqual(['high','low','contra','hand-bell','cha','jamblock','cymbal',null])
})

it('separates head and shell inside the visible timbale, independent of image padding', () => {
  const alpha=new Uint8Array(100*100)
  for(let y=40;y<80;y++) for(let x=20;x<80;x++) alpha[y*100+x]=255
  const mask={width:100,height:100,alpha}
  expect(timbalSoundUrl('high',.5,.476,mask)).toBe('/audio/quiz-timbal/high-head.wav')
  expect(timbalSoundUrl('high',.5,.7,mask)).toBe('/audio/quiz-timbal/high-shell.wav')
  expect(timbalSoundUrl('low',.5,.476,mask)).toBe('/audio/quiz-timbal/low-head.wav')
  expect(timbalSoundUrl('low',.5,.7,mask)).toBe('/audio/quiz-timbal/low-shell.wav')
  expect(timbalSoundUrl('low',.5,.5)).toBeNull()
})
