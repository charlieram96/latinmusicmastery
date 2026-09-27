// PlaySense Studio — the track instrument picker's options. Moved out of
// integrated-editor.tsx so both it and ScoreMetaEditor (Task 5: the Score
// panel now owns the track-name/instrument fields) can use the same list.
import type { Instrument } from '@/components/playsense-studio/shared/score-model/types';

export const INSTRUMENT_OPTIONS: Array<{ value: Instrument; label: string }> = [
  { value: 'staff', label: 'Staff' },
  { value: 'guitar', label: 'Guitar' },
  { value: 'bass', label: 'Bass' },
  { value: 'tres', label: 'Cuban Tres' },
  { value: 'cuatro', label: 'Cuatro' },
  { value: 'tiple', label: 'Tiple' },
  { value: 'ukulele', label: 'Ukulele' },
  { value: 'mandolin', label: 'Mandolin' },
  { value: 'piano', label: 'Piano' },
  { value: 'perc-kit', label: 'Drum Kit' },
  { value: 'perc-conga', label: 'Conga' },
  { value: 'perc-bongo', label: 'Bongo' },
  { value: 'perc-timbal', label: 'Timbales' },
  { value: 'perc-clave', label: 'Clave' },
];
