import type { LessonPresentation } from './lesson-presentation'

export const CASCARA_PASO_FILE = 'ddc2fad9-9e78-457b-94d4-1bd1bf0b7738-1792542908091.m4v'
// Stroke positions from the first and second Relleno Mano Izq Cáscara sections,
// measure 2 (section IDs c86cef70… and 38da3dd8…). Eight eighth-note slots.
export const CASCARA_VOCAL_PATTERNS = [
  [false,true,false,true,false,false,true,false],
  [false,true,false,false,true,false,true,false],
].map(pattern => pattern.map(low => ({ low, syllable: low ? 'u' : 'cha' })))
export type VocalRhythmPhrase = {
  start: number; end: number
  hits: readonly { at: number; bar: number; slot: number; syllable: string }[]
}
function phrase(bar: number, times: number[]): VocalRhythmPhrase {
  return { start: times[0] - .45, end: times.at(-1)! + .65,
    hits: times.map((at, slot) => ({ at, bar, slot, syllable: CASCARA_VOCAL_PATTERNS[bar][slot].syllable })) }
}
// Speech transcript identifies each phrase; waveform attack boundaries refine each syllable.
// Exact uploaded audio clock, including the two final complete cycles; no free-running BPM.
export const cascaraVocalPhrases: readonly VocalRhythmPhrase[] = [
  phrase(0, [15.516,16.135,16.733,17.349,17.925,18.524,19.165,19.730]),
  phrase(0, [22.758,23.355,23.936,24.548,25.135,25.742,26.343,26.931]),
  phrase(0, [29.914,30.559,31.125,31.760,32.338,32.928,33.597,34.153]),
  phrase(1, [39.742,40.343,40.919,41.502,42.097,42.692,43.312,43.913]),
  phrase(1, [46.893,47.564,48.104,48.704,49.298,49.897,50.538,51.091]),
  {
    start:56.39,end:76.05,
    hits: [
      ...phrase(0, [56.839,57.454,58.043,58.699,59.306,59.911,60.540,61.062]).hits,
      ...phrase(1, [61.697,62.359,62.879,63.444,64.080,64.652,65.295,65.860]).hits,
      ...phrase(0, [66.523,67.100,67.623,68.284,68.844,69.461,70.101,70.656]).hits,
      ...phrase(1, [71.308,71.945,72.475,73.076,73.647,74.222,74.866,75.445]).hits,
    ],
  },
]
export const cascaraPasoPresentation: LessonPresentation = {
  id: 'cascara-paso-vocal-v1', instructor: 'Patricio «el chino» Díaz', cues: [],
  vocalRhythms: cascaraVocalPhrases,
  spokenCounts: [
    {start:12.76,end:15.35,beats:[{at:12.76,number:1},{at:13.78,number:2},{at:14.38,number:3},{at:14.92,number:4}]},
    {start:37.26,end:39.45,beats:[{at:37.26,number:1},{at:37.92,number:2},{at:38.54,number:3},{at:39.10,number:4}]},
    {start:54.42,end:56.50,beats:[{at:54.42,number:1},{at:54.98,number:2},{at:55.68,number:3},{at:56.18,number:4}]},
  ],
}
export function vocalRhythmAt(phrases: readonly VocalRhythmPhrase[], time: number) {
  return phrases.find(phrase => time >= phrase.start && time < phrase.end) ?? null
}
