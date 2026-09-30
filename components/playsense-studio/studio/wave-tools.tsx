'use client';
import { useStudioText } from '@/components/playsense-studio/studio/use-studio-text';

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
  autoAlignTitle?: string;
  onStudentPreview?: () => void;
  dragAll: boolean;
  onDragAll: (ripple: boolean) => void;
  flexMode?: boolean;
  onFlex?: () => void;
  flexDeleteMode?: boolean;
  flexAddMode?: boolean;
  onAddPoints?: () => void;
  onDeletePoints?: () => void;
  onResetFlex?: () => void;
  hasFlexPoints?: boolean;
  onAddAnchors?: () => void;
  addAnchorsDisabled?: boolean;
  showNotes: boolean;
  onShowNotes: () => void;
  zoom: { pps: number; onZoomTo: (pps: number) => void; onZoomBy: (f: number) => void; onFit: () => void };
}

export function WaveTools(p: WaveToolsProps) {
  const st = useStudioText();
  return (
    <div className="st-wtools" role="toolbar" aria-label={st("Waveform tools")}>
      {p.graded ? (
        <>
          {p.onStudentPreview && (
            <button type="button" className="st-wtools-auto" aria-label={st("Student preview")} title={st("Play it the way a student gets it")} onClick={p.onStudentPreview}>
              <Play className="h-3.5 w-3.5" />{st("Student preview")}</button>
          )}
          <button type="button" className="st-wtools-auto is-quiet" aria-label={st("Auto-align")} disabled={p.autoAlignDisabled}
            title={st(p.autoAlignTitle ?? 'Line the play-along up with the tempo grid')} onClick={p.onAutoAlign}>
            <Wand2 className="h-3.5 w-3.5" />{st("Auto-align")}</button>
        </>
      ) : (
        <button type="button" className="st-wtools-auto" aria-label={st("Auto-place bars")} disabled={p.autoPlaceDisabled}
          title={st(p.autoPlaceTitle ?? 'Fit every bar line to the recording')} onClick={p.onAutoPlace}>
          <Wand2 className="h-3.5 w-3.5" />{st("Auto-place")}</button>
      )}
      <span className="st-divline" />
      {(
        <div className="st-seg" role="radiogroup" aria-label={st("Drag mode")}>
          <button type="button" aria-label={st("Ripple")} className={p.dragAll ? 'is-on' : ''} onClick={() => p.onDragAll(true)}
            title={st("Ripple — dragging a measure moves it and everything after it (hold Option to move just one)")}>
            <ChevronsLeftRight className="h-3.5 w-3.5" />{st("Ripple")}</button>
          <button type="button" aria-label={st("Single")} className={!p.dragAll ? 'is-on' : ''} onClick={() => p.onDragAll(false)}
            title={st("Single — dragging moves only that measure or marker (hold Option to ripple)")}>
            <Move className="h-3.5 w-3.5" />{st("Single")}</button>
        </div>
      )}
      {p.onFlex && (
        <button type="button" aria-label={st("Flex")} aria-pressed={!!p.flexMode} className={`st-wtools-auto${p.flexMode ? '' : ' is-quiet'}`}
          title={st("Show or hide Flex editing points without changing audio adjustments (F)")} onClick={p.onFlex}>
          <Spline className="h-4 w-4" />{st(p.flexMode ? "Hide Flex points" : "Show Flex points")}
        </button>
      )}
      {p.onAddPoints && <button type="button" className={`st-wtools-auto${p.flexAddMode ? '' : ' is-quiet'}`} aria-pressed={!!p.flexAddMode}
        onClick={p.onAddPoints} title={st("Click the waveform to add a Flex point")}>{st("Add points")}</button>}
      {p.onAddAnchors && <button type="button" aria-label={st("Add transient anchors")} className="st-wtools-auto is-quiet"
        disabled={p.addAnchorsDisabled} onClick={p.onAddAnchors} title={st("Create draggable points at the detected sound peaks")}>{st("Add transient anchors")}</button>}
      {p.onDeletePoints && <button type="button" className={`st-wtools-auto${p.flexDeleteMode ? '' : ' is-quiet'}`} aria-pressed={!!p.flexDeleteMode}
        disabled={!p.hasFlexPoints} onClick={p.onDeletePoints} title={st("Click an audio point to remove its adjustment")}>{st("Delete points")}</button>}
      {p.onResetFlex && <button type="button" className="st-wtools-auto is-quiet" disabled={!p.hasFlexPoints}
        onClick={p.onResetFlex} title={st("Remove all Flex points and restore original audio timing")}>{st("Reset Flex")}</button>}
      <button type="button" aria-label={st("Notes on the waveform")} aria-pressed={p.showNotes}
        className={`st-iconbtn${p.showNotes ? ' amber' : ''}`} title={st(p.showNotes ? 'Hide notes on the waveform' : 'Show notes on the waveform')} onClick={p.onShowNotes}>
        <Music2 className="h-4 w-4" />
      </button>
      <span className="st-divline" />
      <ZoomSlider pps={p.zoom.pps} onZoomTo={p.zoom.onZoomTo} onZoomBy={p.zoom.onZoomBy} onFit={p.zoom.onFit} fitLabel="Fit the section" />
    </div>
  );
}
