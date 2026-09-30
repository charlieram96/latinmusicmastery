'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';

// PlaySense Studio — the transport's Hear and Loop speed controls (moved from
// the context bar into the one-row transport, mockup .st-transport).
import { HEAR_OPTIONS, type Hear } from '@/lib/playsense-studio/hear';
import { LOOP_SPEEDS } from '@/lib/playsense-studio/studio-rate';

export function HearControl({ hear, onHear }: { hear: Hear; onHear: (h: Hear) => void }) {
  const st = useStudioText();
  return (
    <div className="st-seg" role="radiogroup" aria-label={st("Hear")} title={st("What you hear while playing")}>
      {HEAR_OPTIONS.map(({ value, label }) => (
        <button key={value} type="button" role="radio" aria-checked={hear === value}
          className={hear === value ? 'is-on' : ''} onClick={() => onHear(value)}>{st(label)}</button>
      ))}
    </div>
  );
}

export function LoopSpeedControl({ rate, onRate }: { rate: number; onRate: (r: number) => void }) {
  const st = useStudioText();
  return (
    <div className="st-seg" role="radiogroup" aria-label={st("Loop speed")} title={st("Loop speed — the recording keeps its pitch")}>
      {LOOP_SPEEDS.map((speed) => {
        const on = Math.abs(rate - speed) < 1e-3;
        return (
          <button key={speed} type="button" role="radio" aria-checked={on} className={on ? 'is-on' : ''}
            onClick={() => onRate(speed)}>{Math.round(speed * 100)}%</button>
        );
      })}
    </div>
  );
}
