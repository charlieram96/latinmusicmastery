import { describe, expect, it } from 'vitest'
import { CASCARA_PASO_FILE, CASCARA_VOCAL_PATTERNS, cascaraVocalPhrases, vocalRhythmAt } from '../cascara-paso-presentation'
import { lessonPresentationFor } from '../lesson-presentation'
describe('Cáscara paso a paso vocal overlay', () => {
  it('uses only its exact upload in local previews', () => {
    expect(lessonPresentationFor('/'+CASCARA_PASO_FILE,true)?.id).toBe('cascara-paso-vocal-v1')
    expect(lessonPresentationFor('/other.m4v',true)).toBeNull()
    expect(lessonPresentationFor('/'+CASCARA_PASO_FILE,false)).toBeNull()
  })
  it('matches the authored first and second bar and covers both final cycles', () => {
    expect(CASCARA_VOCAL_PATTERNS.map(p=>p.map(n=>n.syllable).join(' '))).toEqual(['cha u cha u cha cha u cha','cha u cha cha u cha u cha'])
    expect(cascaraVocalPhrases.at(-1)!.hits).toHaveLength(32)
    for(const phrase of cascaraVocalPhrases) for(let i=1;i<phrase.hits.length;i++) expect(phrase.hits[i].at).toBeGreaterThan(phrase.hits[i-1].at)
  })
  it('follows seeks in both directions and disappears during spoken explanations', () => {
    expect(vocalRhythmAt(cascaraVocalPhrases,52)).toBeNull()
    expect(vocalRhythmAt(cascaraVocalPhrases,75)?.hits.at(-1)?.slot).toBe(7)
    expect(vocalRhythmAt(cascaraVocalPhrases,16)?.hits[0].bar).toBe(0)
    expect(vocalRhythmAt(cascaraVocalPhrases,40)?.hits[0].bar).toBe(1)
    expect(vocalRhythmAt(cascaraVocalPhrases,76.1)).toBeNull()
  })
})
