import type { EditorAction, EventRef, MeasurePropsPatch } from './editor-state';
import type { Articulation, Dynamic, Ornament, ScoreDocument } from '@/components/playsense-studio/shared/score-model/types';
import { writtenValue, type NoteValue } from './rhythm';
import { contextAt } from './measure-edits';

export type PaletteCommand =
 | {kind:'dynamic'; value:Dynamic} | {kind:'articulation';value:Articulation}
 | {kind:'ornament';value:Ornament} | {kind:'rhythm';value:NoteValue;rest?:boolean}
 | {kind:'dots';value:0|1|2} | {kind:'accidental';value:-2|-1|0|1|2}
 | {kind:'tuplet';n:number;m:number} | {kind:'span';value:'slur'|'cresc'|'dim'}
 | {kind:'tie'} | {kind:'grace';slash:boolean} | {kind:'measure';props:MeasurePropsPatch};
export const PALETTE_COMMANDS: Record<string,PaletteCommand> = {};
const add=(names:string[],command:PaletteCommand)=>names.forEach(name=>{PALETTE_COMMANDS[name]=command;});
Object.entries({dynamicPPP:'ppp',dynamicPP:'pp',dynamicPiano:'p',dynamicMP:'mp',dynamicMF:'mf',dynamicForte:'f',dynamicFF:'ff',dynamicFFF:'fff',dynamicSforzato:'sfz',dynamicFortePiano:'fp'}).forEach(([name,value])=>add([name],{kind:'dynamic',value:value as Dynamic}));
Object.entries({Accent:'accent',Staccato:'staccato',Staccatissimo:'staccatissimo',Tenuto:'tenuto',Marcato:'marcato'}).forEach(([name,value])=>add([`artic${name}Above`,`artic${name}Below`],{kind:'articulation',value:value as Articulation}));
add(['fermataAbove','fermataBelow'],{kind:'articulation',value:'fermata'});
Object.entries({ornamentTrill:'trill',ornamentMordent:'mordent',ornamentTurn:'turn'}).forEach(([name,value])=>add([name],{kind:'ornament',value:value as Ornament}));
Object.entries({Whole:'w',Half:'h',Quarter:'q','8th':'8','16th':'16','32nd':'32','64th':'64'}).forEach(([name,value])=>{
 add([`note${name}Up`,`note${name}Down`,...(name==='Whole'?['noteWhole']:[])],{kind:'rhythm',value:value as NoteValue});
 add([`rest${name}`],{kind:'rhythm',value:value as NoteValue,rest:true});
});
add(['augmentationDot','Puntillo'],{kind:'dots',value:1});add(['Doble puntillo'],{kind:'dots',value:2});
Object.entries({accidentalDoubleFlat:-2,accidentalFlat:-1,accidentalNatural:0,accidentalSharp:1,accidentalDoubleSharp:2}).forEach(([name,value])=>add([name],{kind:'accidental',value:value as -2|-1|0|1|2}));
add(['Tresillo'],{kind:'tuplet',n:3,m:2});add(['Dosillo'],{kind:'tuplet',n:2,m:3});add(['Quintillo'],{kind:'tuplet',n:5,m:4});add(['Seisillo'],{kind:'tuplet',n:6,m:4});add(['Septillo'],{kind:'tuplet',n:7,m:4});
add(['Ligadura de unión'],{kind:'tie'});add(['Ligadura de expresión'],{kind:'span',value:'slur'});
add(['Crescendo','dynamicCrescendoHairpin'],{kind:'span',value:'cresc'});add(['Diminuendo','dynamicDiminuendoHairpin'],{kind:'span',value:'dim'});
add(['graceNoteAcciaccaturaStemUp','graceNoteAcciaccaturaStemDown'],{kind:'grace',slash:true});
add(['graceNoteAppoggiaturaStemUp','graceNoteAppoggiaturaStemDown'],{kind:'grace',slash:false});
add(['gClef'],{kind:'measure',props:{clef:'treble'}});add(['fClef'],{kind:'measure',props:{clef:'bass'}});add(['cClef'],{kind:'measure',props:{clef:'alto'}});
add(['barlineSingle'],{kind:'measure',props:{endBarline:'single'}});
add(['barlineFinal'],{kind:'measure',props:{endBarline:'final'}});
add(['barlineDouble'],{kind:'measure',props:{endBarline:'double'}});

export function paletteActions(name:string,score:ScoreDocument,selection:EventRef[],bars:Array<{trackIndex:number;measureIndex:number}>): {actions:EditorAction[];error?:string} {
 const command=PALETTE_COMMANDS[name];
 if(!command)return {actions:[],error:'This symbol is not connected yet.'};
 const refs=[...new Map(selection.map(r=>[`${r.trackIndex}:${r.measureIndex}:${r.voice}:${r.eventIndex}`,r])).values()].sort((a,b)=>a.trackIndex-b.trackIndex||a.measureIndex-b.measureIndex||a.voice-b.voice||a.eventIndex-b.eventIndex);
 if(command.kind==='measure'){
  const targets=[...new Map([...bars,...refs].map(r=>[`${r.trackIndex}:${r.measureIndex}`,r])).values()];
  return targets.length?{actions:targets.map(r=>({type:'set-measure-props',trackIndex:r.trackIndex,measureIndex:r.measureIndex,props:command.props}))}:{actions:[],error:'Select a note or measure first.'};
 }
 if(!refs.length)return {actions:[],error:'Select a note first.'};
 const first=refs[0];
 switch(command.kind){
 case 'dynamic':return {actions:[{type:'set-events-dynamic',refs,dynamic:command.value}]};
 case 'articulation':return {actions:[{type:'toggle-events-articulation',refs,articulation:command.value}]};
 case 'ornament':return {actions:[{type:'set-events-ornament',refs,ornament:command.value}]};
 case 'dots':return {actions:[{type:'set-events-rhythm',refs,dots:command.value}]};
 case 'rhythm':{
 const changed = refs.filter(r => { const e = score.tracks[r.trackIndex]?.measures[r.measureIndex]?.voices[r.voice]?.events[r.eventIndex]; return e && writtenValue(e) !== command.value; });
 return {actions:[...(changed.length ? [{type:'set-events-rhythm' as const,refs:changed,value:command.value}] : []),...(command.rest?[{type:'delete-selected-pitches' as const,refs:refs.flatMap(r=>{
  const e=score.tracks[r.trackIndex]?.measures[r.measureIndex]?.voices[r.voice]?.events[r.eventIndex];
  return Array.from({length:e?.kind==='chord'?e.notes.length:1},(_,member)=>({...r,member}));
 })}]:[])]}; }
 case 'accidental':return {actions:refs.map(r=>({type:'set-events-accidental',refs:[r],alter:command.value,keyFifths:contextAt(score,score.tracks[r.trackIndex],r.measureIndex).keyFifths}))};
 case 'tuplet':return refs.length===1?{actions:[{type:'apply-tuplet',ref:first,n:command.n,m:command.m}]}:{actions:[],error:'Select one note to create a tuplet.'};
 case 'span':return refs.length>=2&&refs.every(r=>r.trackIndex===first.trackIndex&&r.voice===first.voice)?{actions:[{type:'toggle-span',spanType:command.value,from:first,to:refs.at(-1)!}]}:{actions:[],error:'Select at least two notes in the same staff and voice.'};
 case 'tie':return {actions:refs.map(ref=>({type:'toggle-event-tie',ref}))};
 case 'grace':return {actions:refs.map(ref=>({type:'toggle-event-grace',ref,slash:command.slash,keyFifths:contextAt(score,score.tracks[ref.trackIndex],ref.measureIndex).keyFifths}))};
 }
}
