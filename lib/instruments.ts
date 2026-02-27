export const SUBSCRIBABLE_INSTRUMENTS = [
  'Bass',
  'Conga',
  'Drums',
  'Guitar',
  'Minor Percussion',
  'Piano',
  'Timbal',
  'Tres',
  'Violin',
] as const

export type SubscribableInstrument = (typeof SUBSCRIBABLE_INSTRUMENTS)[number]
