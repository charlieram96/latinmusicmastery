export type DrumSurface = string

export interface PlaySenseMapping {
  instrument: 'conga' | 'timbale'
  piezoMap: Record<number, DrumSurface>
  useMic: boolean
}

export const CONGA_MAPPING: PlaySenseMapping = {
  instrument: 'conga',
  piezoMap: { 0: 'quinto', 1: 'conga', 2: 'tumba' },
  useMic: true,
}

export const TIMBALE_MAPPING: PlaySenseMapping = {
  instrument: 'timbale',
  piezoMap: {
    0: 'macho',
    1: 'hembra',
    2: 'campana',
    3: 'cencerro',
    4: 'jamblock',
    5: 'cascara',
  },
  useMic: false,
}

export const PLAYSENSE_MAPPINGS: Record<string, PlaySenseMapping> = {
  conga: CONGA_MAPPING,
  timbale: TIMBALE_MAPPING,
}

/** Instruments that support PlaySense device input */
export const PLAYSENSE_INSTRUMENTS = new Set(['conga', 'timbale'])

/** Get the PlaySense mapping for an instrument, or null if unsupported */
export function getPlaySenseMapping(instrument: string): PlaySenseMapping | null {
  return PLAYSENSE_MAPPINGS[instrument] ?? null
}
