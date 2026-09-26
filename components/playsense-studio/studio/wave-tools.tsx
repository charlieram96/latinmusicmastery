'use client';
// PlaySense Studio — the waveform's floating tool cluster (mockup .wtools):
// everything that acts on the waveform lane, top-right over it, dimmed until
// hovered. Replaces the old context-bar row.
import { ChevronsLeftRight, Move, Music2, Play, Spline, Wand2 } from 'lucide-react';
import { ZoomSlider } from '@/components/playsense-studio/sync/zoom-slider';

export interface WaveToolsProps {
  graded: boolean;
  /** Video: Auto-place bars. */
  onAutoPlace?: () => void;
  autoPlaceDisabled?: boolean;
  autoPlaceTitle?: string;
  /** Graded: Auto-align the media to the tempo grid. */
  onAutoAlign?: () => void;
  autoAlignDisabled?: boolean;
  onStudentPreview?: () => void;
  dragAll: boolean;
  onDragAll: (ripple: boolean) => void;
  flexMode?: boolean;
  onFlex?: () => void;
  showNotes: boolean;
  onShowNotes: () => void;
  zoom: { pps: number; onZoomTo: (pps: number) => void; onZoomBy: (f: number) => void; onFit: () => void };
}

export function WaveTools(p: WaveToolsProps) {
  return (
    <div className="st-wtools" role="toolbar" aria-label="Waveform tools">
      {p.graded ? (
        <>
          {p.onStudentPreview && (
            <button type="button" className="st-wtools-auto" aria-label="Student preview" title="Play it the way a student gets it" onClick={p.onStudentPreview}>
              <Play className="h-3.5 w-3.5" />Student preview
            </button>
          )}
          <button type="button" className="st-wtools-auto is-quiet" aria-label="Auto-align" disabled={p.autoAlignDisabled}
            title="Line the play-along up with the tempo grid" onClick={p.onAutoAlign}>
            <Wand2 className="h-3.5 w-3.5" />Auto-align
          </button>
        </>
      ) : (
        <button type="button" className="st-wtools-auto" aria-label="Auto-place bars" disabled={p.autoPlaceDisabled}
          title={p.autoPlaceTitle ?? 'Fit every bar line to the recording'} onClick={p.onAutoPlace}>
          <Wand2 className="h-3.5 w-3.5" />Auto-place
        </button>
      )}
      <span className="st-divline" />
      {!p.graded && (
        <div className="st-seg" role="radiogroup" aria-label="Drag mode">
          <button type="button" aria-label="Ripple" className={p.dragAll ? 'is-on' : ''} onClick={() => p.onDragAll(true)}
            title="Ripple — dragging a measure moves it and everything after it (hold Option to move just one)">
            <ChevronsLeftRight className="h-3.5 w-3.5" />Ripple
          </button>
          <button type="button" aria-label="Single" className={!p.dragAll ? 'is-on' : ''} onClick={() => p.onDragAll(false)}
            title="Single — dragging moves only that measure or marker (hold Option to ripple)">
            <Move className="h-3.5 w-3.5" />Single
          </button>
        </div>
      )}
      {!p.graded && p.onFlex && (
        <button type="button" aria-label="Flex" aria-pressed={!!p.flexMode} className={`st-iconbtn${p.flexMode ? ' is-on amber' : ''}`}
          title="Flex — click a hit to add a point, drag it onto the written note, double-click to remove (F)" onClick={p.onFlex}>
          <Spline className="h-4 w-4" />
        </button>
      )}
      <button type="button" aria-label="Notes on the waveform" aria-pressed={p.showNotes}
        className={`st-iconbtn${p.showNotes ? ' amber' : ''}`} title={p.showNotes ? 'Hide notes on the waveform' : 'Show notes on the waveform'} onClick={p.onShowNotes}>
        <Music2 className="h-4 w-4" />
      </button>
      <span className="st-divline" />
      <ZoomSlider pps={p.zoom.pps} onZoomTo={p.zoom.onZoomTo} onZoomBy={p.zoom.onZoomBy} onFit={p.zoom.onFit} fitLabel="Fit the section" />
    </div>
  );
}
