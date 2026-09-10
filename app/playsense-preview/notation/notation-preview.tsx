'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Pause, Play, RotateCcw } from 'lucide-react';
import { StaffRenderer } from '@/components/playsense-studio/player/notation/renderers/staff-renderer';
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { trackDurationMs } from '@/lib/playsense-studio/time-mapping';
import { Button } from '@/components/ui/button';

/** Local fixture clock exercises the same animation path as lesson video playback. */
export function NotationPreview({ score }: { score: ScoreDocument }) {
  const [transport, setTransport] = useState({ timeMs: -60000, playing: false });
  const clock = useRef(transport.timeMs);
  const getCurrentMs = useCallback(() => clock.current, []);
  const scoreEnd = trackDurationMs(score.tracks[0], score);
  const end = scoreEnd + 357000;

  useEffect(() => {
    clock.current = transport.timeMs;
    if (!transport.playing) return;
    const started = performance.now();
    let frame = 0;
    const tick = (now: number) => {
      clock.current = Math.min(end, transport.timeMs + now - started);
      if (clock.current >= end) {
        setTransport({ timeMs: end, playing: false });
        return;
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [transport, end]);

  const seek = (timeMs: number) => {
    clock.current = timeMs;
    setTransport(previous => ({ ...previous, timeMs }));
  };
  const notation = {
    score, trackIndex: 0, currentMs: transport.timeMs, getCurrentMs,
    leadingGapMs: 80000, trailingGapMs: 357000,
    leadingGapLabel: 'Before the first measure', trailingGapLabel: 'The video continues',
  };
  return <main className="min-h-screen bg-background p-6 text-foreground md:p-10">
    <div className="mx-auto max-w-6xl space-y-7">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">PlaySense · Score preview</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => setTransport({ timeMs: clock.current >= end ? -80000 : clock.current, playing: !transport.playing })}>
            {transport.playing ? <Pause className="mr-2 h-3.5 w-3.5" /> : <Play className="mr-2 h-3.5 w-3.5" />}
            {transport.playing ? 'Pause preview' : 'Play preview'}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => seek(-80000)}><RotateCcw className="mr-2 h-3.5 w-3.5" />Restart</Button>
          <Button size="sm" variant="outline" onClick={() => seek(-40000)}>Intro midpoint</Button>
          <Button size="sm" variant="outline" onClick={() => seek(0)}>Music</Button>
          <Button size="sm" variant="outline" onClick={() => seek(scoreEnd + 178500)}>Video midpoint</Button>
        </div>
      </div>
      <section aria-label="Horizontal score" className="rounded-lg border border-border bg-card p-5">
        <StaffRenderer {...notation} layoutMode="scroll" />
      </section>
      <section aria-label="Stacked score" className="h-[640px] w-[760px] max-w-full rounded-lg border border-border bg-card p-5">
        <StaffRenderer {...notation} layoutMode="wrapped" />
      </section>
    </div>
  </main>;
}
