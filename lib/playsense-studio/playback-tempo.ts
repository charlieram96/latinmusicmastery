import type {ScoreDocument, Track} from '@/components/playsense-studio/shared/score-model/types';
/** A per-score admin override never rewrites the uploaded tempo or sync map. */
export function scorePlaybackRate(score: Pick<ScoreDocument,'initialTempo'|'playbackTempoOverride'>): number {
 const bpm=score.playbackTempoOverride;
 return bpm && Number.isFinite(bpm) && score.initialTempo>0 ? Math.max(.1,Math.min(2,bpm/score.initialTempo)) : 1;
}

/** An imported opening mark must not silently replace the score reference. */
export function playbackTrack(track:Track,score:ScoreDocument):Track {
 const first=track.measures[0];
 if(first?.tempoChange===undefined||first.tempoChange===score.initialTempo)return track;
 // Importers repeat the opening mark at system/repeat boundaries. Those are
 // the same reference tempo, not new musical changes back to the old BPM.
 let openingSection=true;
 return {...track,measures:track.measures.map(measure=>{
  if(measure.tempoChange!==undefined&&measure.tempoChange!==first.tempoChange)openingSection=false;
  return openingSection&&measure.tempoChange===first.tempoChange?{...measure,tempoChange:score.initialTempo}:measure;
 })};
}

/** Match the exercise grid: imported tempo marks are inactive until reviewed. */
export function exercisePlaybackScore(score:ScoreDocument):ScoreDocument {
 if(score.tempoMarksConfirmed)return score;
 return {...score,tracks:score.tracks.map(track=>({...track,measures:track.measures.map(measure=>{
  const {tempoChange,...rest}=measure;
  return tempoChange===undefined?measure:rest;
 })}))};
}
