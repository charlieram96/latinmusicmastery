import type {Instrument,ScoreDocument} from '@/components/playsense-studio/shared/score-model/types';
import {applyInstrumentLegend} from './instrument-legend';
import {staffGroupIndices} from './staff-groups';
/** Preserve imported notes; provide an empty lower staff when explicitly chosen. */
export function prepareImportedInstrument(score:ScoreDocument,index:number,choice:Instrument|'harp') {
 const next=applyInstrumentLegend(score,index,choice==='harp'?'piano':choice);
 const group=staffGroupIndices(next,index);
 if(choice==='harp')for(const i of group)next.tracks[i].displayName='Arpa';
 if(!['piano','harp','guitar'].includes(choice)||group.length!==1)return next;
 const first=next.tracks[index];const groupId=first.staffGroup??`import-part-${index}`;
 first.staffGroup=groupId;first.staffNumber=1;
 next.tracks.push({...structuredClone(first),index:next.tracks.length,staffNumber:2,
   measures:first.measures.map(m=>({...structuredClone(m),clef:'bass',voices:m.voices.map(v=>({...v,events:[]}))}))});
 return next;
}
