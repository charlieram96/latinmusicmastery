'use client';

import { useMemo } from 'react';
import { EditableMeasureStrip, type MeasureStripItem } from './editable-measure-strip';
import type { LaneSection } from '../sync/sections-lane';
import { seedMarkerState, noteTime } from '../sync/marker-model';
import { extractTrackEvents } from '@/lib/playsense-studio/score-to-vexflow';
import { measureFill } from '@/lib/playsense-studio/measure-fill';
import { readNudges } from '@/lib/playsense-studio/drafts/timing';
import { hasFinalBarline } from '@/lib/playsense-studio/barlines';

/** Other sections stay engraved in the same time coordinates as the active score.
 * Selecting them changes the editor, never their authored timing. */
export function SiblingSectionScores({ sections, activeSectionId, trackIndex, height, pixelsPerSecond, scrollLeftPx, onSelectSection }: {
  sections: LaneSection[]; activeSectionId: string; trackIndex: number; height: number;
  pixelsPerSecond: number; scrollLeftPx: number; onSelectSection: (id: string) => void;
}) {
  const rows = useMemo(() => sections.flatMap(section => {
    const score = section.score;
    const track = score?.tracks[trackIndex];
    if (section.sectionId === activeSectionId || !score || !track || !section.timing?.waypoints.length) return [];
    const markers = seedMarkerState(track, score, section.timing.waypoints, readNudges(section.timing.params));
    const events = extractTrackEvents(track, score.initialTimeSignature, score.initialKeyFifths);
    const items: MeasureStripItem[] = events.slice(0, markers.measures.length).map((t, i) => ({
      continuousBarlines: !!section.continuousProject,
      measureIndex: i, measureNumber: t.measure.number, repeatPass: t.measure.repeat,
      repeatStart:t.measure.repeatStart, repeatEnd:t.measure.repeatEnd, volta:t.measure.volta, endBarline: t.measure.endBarline, emptyText: t.measure.emptyText, finalBarline: hasFinalBarline(track.measures, i),
      startVideoTimeSeconds: markers.measures[i].beats[0].videoTimeSeconds,
      endVideoTimeSeconds: markers.measures[i + 1]?.beats[0].videoTimeSeconds ?? markers.tailVideoTimeSeconds,
      events: t.events, voice2Events: t.voice2Events, timeSignature: t.timeSignature,
      isFirst: i === 0 && (!section.continuousProject || sections[0]?.sectionId === section.sectionId), clef: t.clef, keyFifths: t.keyFifths,
      previousKeyFifths: t.previousKeyFifths, keyChanged: t.keyChanged, clefChanged: t.clefChanged,
      fill: measureFill(t.measure.voices[0]?.events ?? [], t.measure.voices[1]?.events, t.timeSignature, t.measure),
    }));
    return items.length ? [{ section, items, markers }] : [];
  }), [sections, activeSectionId, trackIndex]);
  return <>{rows.map(({ section, items, markers }) => {
    const left = items[0].startVideoTimeSeconds * pixelsPerSecond - scrollLeftPx;
    const right = items[items.length - 1].endVideoTimeSeconds * pixelsPerSecond - scrollLeftPx;
    const select = () => onSelectSection(section.sectionId);
    return <div key={section.sectionId} data-score-preserve-selection data-section-score={section.sectionId}
      className={section.continuousProject ? "absolute inset-x-0 bottom-0 [&>div]:bg-transparent [&>div]:border-transparent" : "absolute inset-x-0 bottom-0"} style={{ height, clipPath: `inset(0 max(0px, calc(100% - ${right}px)) 0 ${Math.max(0, left - (items[0].isFirst ? 110 : 24))}px)` }}
      aria-label={section.label}>
      <EditableMeasureStrip measures={items} spans={section.score?.spans} height={height}
        pixelsPerSecond={pixelsPerSecond} scrollLeftPx={scrollLeftPx} selected={null} noteTimeForQN={qn => noteTime(markers, qn)}
        onSelectMeasure={select} onSelectMeasureRange={select} onOpenMeasure={select}
        onOpenNote={select} onRequestZoomTo={select} />
    </div>;
  })}</>;
}
