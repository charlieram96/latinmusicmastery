import { getInstrumentCategory, type Instrument } from './types'
import { PLAYSENSE_INSTRUMENTS } from './playsense-mappings'

export type AudioMode = 'headphones' | 'speaker-safe' | 'playsense' | 'midi'

export function availableInputModes(instrument: Instrument): AudioMode[] {
  const modes: AudioMode[] = ['headphones', 'speaker-safe']
  if (getInstrumentCategory(instrument) === 'pitched') modes.push('midi')
  if (PLAYSENSE_INSTRUMENTS.has(instrument)) modes.push('playsense')
  return modes
}

export function nextInputMode(instrument: Instrument, current: AudioMode | null): AudioMode {
  const modes = availableInputModes(instrument)
  return modes[(modes.indexOf(current as AudioMode) + 1) % modes.length]
}
