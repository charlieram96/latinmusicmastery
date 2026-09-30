import type {Instrument,ScoreDocument} from '@/components/playsense-studio/shared/score-model/types';
import {getPercStrokes,isPercussion,percussionNotation,strokeNotation} from './perc-strokes';
import {contextAt} from './measure-edits';
import {spellMidi} from './notation/accidentals';
import {staffGroupIndices} from './staff-groups';
export const IMPORT_INSTRUMENTS: [Instrument,string][] = [['staff','Staff'],['piano','Piano'],['guitar','Guitar'],['bass','Bass'],['tres','Tres'],['cuatro','Cuatro'],['tiple','Tiple'],['ukulele','Ukulele'],['mandolin','Mandolin'],['perc-timbal','Timbal'],['perc-conga','Conga'],['perc-bongo','Bongo'],['perc-clave','Clave'],['perc-kit','Drum kit']];
/** Choose a teaching instrument without discarding explicit imported notation. */
export function applyInstrumentLegend(score:ScoreDocument,trackIndex:number,instrument:Instrument):ScoreDocument {
 const next=structuredClone(score);
 for(const index of staffGroupIndices(score,trackIndex)) {
  const track=next.tracks[index];const source=score.tracks[index];
  track.instrument=instrument;
  if(!isPercussion(instrument))continue;
  track.defaultView='staff';
  const strokes=getPercStrokes(instrument)??[];
  track.measures.forEach((measure,m)=>{
   measure.clef='percussion';
   const keyFifths=contextAt(score,source,m).keyFifths;
   for(const voice of measure.voices)for(const event of voice.events)for(const note of event.kind==='note'?[event]:event.kind==='chord'?event.notes:[]) {
    if(note.percussion)continue;
    if(isPercussion(source.instrument)&&source.instrument===instrument) {note.percussion=percussionNotation(instrument,note);continue;}
    const spelling=spellMidi(note.midi,{spelling:note.spelling,spellingHint:note.spellingHint,keyFifths});
    const staffLine=isPercussion(source.instrument)?percussionNotation(source.instrument,note).staffLine:`${spelling.step.toLowerCase()}/${spelling.octave}`;
    const matches=strokes.filter(s=>s.staffLine===staffLine);
    const stroke=matches.find(s=>s.defaultForEntry)??matches[0];
    const sourceMidi=note.midi;
    note.percussion=stroke?{...strokeNotation(stroke),sourceMidi}:{staffLine,notehead:'normal',sourceMidi};
    if(stroke)note.midi=stroke.midi;
   }
  });
 }
 return next;
}
