import type { Instrument } from '@/lib/play-sense/types'

/** The student occupies one chair in the band; the backline supplies the other part. */
export function backingPercussion(instrument: Instrument): 'conga' | 'timbale' {
  return instrument === 'timbale' ? 'conga' : 'timbale'
}

export function backingBandLabel(instrument: Instrument): string {
  return `Bass · Keys · ${backingPercussion(instrument) === 'conga' ? 'Congas' : 'Timbales'}`
}
