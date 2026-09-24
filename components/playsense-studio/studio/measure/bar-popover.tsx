'use client';

// The Bar ▾ menu: meter, key, clef, barlines, endings and a tempo mark for one
// bar. A tempo mark here writes Measure.tempoChange (spec §8); see
// lib/playsense-studio/tempo-marks.ts for what happens with imported ones.

import { useRef, type FormEvent } from 'react';
import { keySignatureName } from '@/lib/playsense-studio/notation/accidentals';
import type { MeasurePropsPatch } from '@/lib/playsense-studio/editor-state';
import { MeasurePopover, type PopoverAnchor } from './popover';

const TIME_SIGNATURES: Array<[number, number]> = [
  [2, 4], [3, 4], [4, 4], [5, 4], [6, 8], [7, 8], [12, 8], [2, 2],
];
const CLEFS: Array<{ value: 'treble' | 'bass' | 'alto' | 'tenor'; label: string }> = [
  { value: 'treble', label: 'Treble' },
  { value: 'bass', label: 'Bass' },
  { value: 'alto', label: 'Alto' },
  { value: 'tenor', label: 'Tenor' },
];
const KEY_FIFTHS = Array.from({ length: 15 }, (_, i) => i - 7); // -7..7

export function BarPopover({ anchor, measureNumber, percussion, current, onPatch, onFinal, onClose }: {
  anchor: PopoverAnchor; measureIndex: number; measureNumber: number; percussion: boolean;
  current: { timeSignature: [number, number]; keyFifths: number; clef: 'treble' | 'bass' | 'alto' | 'tenor'; tempo: number;
             repeatStart: boolean; repeatEnd: boolean; double: boolean; final: boolean; volta: '1.' | '2.' | null };
  onPatch: (p: MeasurePropsPatch) => void; onFinal: (final: boolean) => void; onClose: () => void;
}) {
  const tempoRef = useRef<HTMLInputElement | null>(null);

  const toggleVolta = (v: '1.' | '2.') => onPatch({ volta: current.volta === v ? null : v });

  const onTempoSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const v = Number(tempoRef.current?.value);
    if (Number.isFinite(v) && v >= 30 && v <= 300) onPatch({ tempo: v });
  };

  return (
    <MeasurePopover anchor={anchor} title={`Bar m.${measureNumber}`} onClose={onClose}>
      <div className="st-mpop-row">
        {TIME_SIGNATURES.map(([n, d]) => (
          <button key={`${n}/${d}`} type="button" className="st-mpop-chip"
            aria-pressed={current.timeSignature[0] === n && current.timeSignature[1] === d}
            onClick={() => onPatch({ timeSignature: [n, d] })}>
            {n}/{d}
          </button>
        ))}
      </div>

      {!percussion && (
        <div className="st-mpop-row">
          <select aria-label="Key" className="st-input" value={current.keyFifths}
            onChange={(e) => onPatch({ keyFifths: Number(e.target.value) })}>
            {KEY_FIFTHS.map((f) => (
              <option key={f} value={f}>{keySignatureName(f)} major</option>
            ))}
          </select>
          <select aria-label="Clef" className="st-input" value={current.clef}
            onChange={(e) => onPatch({ clef: e.target.value as 'treble' | 'bass' | 'alto' | 'tenor' })}>
            {CLEFS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      )}

      <div className="st-mpop-row">
        <button type="button" className="st-mpop-chip" aria-pressed={current.repeatStart}
          onClick={() => onPatch({ repeatStart: !current.repeatStart })}>Start repeat</button>
        <button type="button" className="st-mpop-chip" aria-pressed={current.repeatEnd}
          onClick={() => onPatch({ repeatEnd: !current.repeatEnd })}>End repeat</button>
        <button type="button" className="st-mpop-chip" aria-pressed={current.double}
          onClick={() => onPatch({ endBarline: current.double ? null : 'double' })}>Double barline</button>
        <button type="button" className="st-mpop-chip" aria-pressed={current.final}
          onClick={() => onFinal(!current.final)}>Final barline</button>
        <button type="button" className="st-mpop-chip" aria-pressed={current.volta === '1.'}
          onClick={() => toggleVolta('1.')}>1st ending</button>
        <button type="button" className="st-mpop-chip" aria-pressed={current.volta === '2.'}
          onClick={() => toggleVolta('2.')}>2nd ending</button>
      </div>

      <form className="st-mpop-row" onSubmit={onTempoSubmit}>
        <input ref={tempoRef} type="number" min={30} max={300} defaultValue={current.tempo} aria-label="Tempo" className="st-input w-16" />
        <button type="submit" className="st-mpop-item">Set ♩ =</button>
      </form>
    </MeasurePopover>
  );
}
