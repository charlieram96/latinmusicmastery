'use client';

// PlaySense Studio click-track toggle — runs a Web Audio metronome alongside the video.
//
// The metronome runs on its own AudioContext clock (not synced to the video).
// For a tight teaching feel this is fine because the video's audio carries
// the actual reference; the metronome is a practice aid that ticks the score
// tempo. M7's sync tools will tighten this if needed.

import { Bell, BellOff } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Metronome } from '@/lib/playsense-studio/metronome';

interface ClickTrackToggleProps {
  bpm: number;
  beatsPerMeasure: number;
  /** When true the metronome only plays while the video is playing. */
  isPlaying: boolean;
}

export function ClickTrackToggle({
  bpm,
  beatsPerMeasure,
  isPlaying,
}: ClickTrackToggleProps) {
  const [enabled, setEnabled] = useState(false);
  const metronomeRef = useRef<Metronome | null>(null);

  // Ensure a Metronome instance exists.
  useEffect(() => {
    metronomeRef.current = new Metronome({ bpm, beatsPerMeasure });
    return () => {
      metronomeRef.current?.destroy();
      metronomeRef.current = null;
    };
  }, [bpm, beatsPerMeasure]);

  // Run/stop based on enabled + isPlaying.
  useEffect(() => {
    const m = metronomeRef.current;
    if (!m) return;
    if (enabled && isPlaying) {
      m.updateOptions({ bpm, beatsPerMeasure });
      m.start();
    } else {
      m.stop();
    }
    return () => {
      m.stop();
    };
  }, [enabled, isPlaying, bpm, beatsPerMeasure]);

  return (
    <button
      onClick={() => setEnabled((v) => !v)}
      className={`p-1.5 rounded text-xs border transition ${
        enabled
          ? 'bg-primary text-primary-foreground border-primary'
          : 'border-border hover:bg-muted'
      }`}
      title={enabled ? 'Click track on' : 'Click track off'}
      aria-pressed={enabled}
    >
      {enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
    </button>
  );
}
