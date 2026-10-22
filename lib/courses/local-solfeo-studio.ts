import { publishedContentEnabled } from '@/lib/release/content'
import { readReleaseDocument, writeReleaseDocument } from '@/lib/release/documents'
/** Local persistence adapter for the shared PlaySense Studio. */
import { readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { usesLocalSolfeo, readLocalSolfeo, localItem } from './local-solfeo-draft'
import type { ClassItemScoreSection } from '@/app/actions/playsense-studio'
import type { StudioDraft, StudioVersionListItem } from '@/app/actions/studio-drafts'
import type { ScoreDocument } from '@/components/playsense-studio/shared/score-model/types'
import { EMPTY_TIMING, type StudioTiming } from '@/lib/playsense-studio/drafts/timing'

type Section = { itemId:string; id:string; score:ScoreDocument; timing:StudioTiming; draft:StudioDraft|null; versions:Array<StudioVersionListItem & StudioDraft> }
type Store = { sections:Section[]; media:Record<string,{trimInSeconds:number;trimOutSeconds:number|null;bpm:number;anchorSeconds:number|null;segments?:Array<{from:number;to:number;bpm:number}>}> }
const file=path.join(process.cwd(),'local-artifacts/solfeo-course/studio.json')
let pending:Promise<unknown>=Promise.resolve()
export async function localStudio<T>(id:string, edit:(store:Store)=>T, write=false):Promise<T> {
 if(!await usesLocalSolfeo(id))throw new Error('Local Studio is unavailable')
 const task=pending.then(async()=>{let store:Store
  try{store=JSON.parse(publishedContentEnabled()?await readReleaseDocument('local-artifacts/solfeo-course/studio.json'):await readFile(file,'utf8'))}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;store={sections:[],media:{}}}
  const result=edit(store)
  if(write){if(publishedContentEnabled())await writeReleaseDocument('local-artifacts/solfeo-course/studio.json',JSON.stringify(store,null,2)+'\n');else{await writeFile(file+'.tmp',JSON.stringify(store,null,2)+'\n');await rename(file+'.tmp',file)}}
  return result
 });pending=task.catch(()=>undefined);return task
}
export function findLocalSection(store:Store,id:string){const s=store.sections.find(s=>s.id===id);if(!s)throw new Error('Local section not found');return s}
export async function localStudioSections(itemId:string,drafts=true):Promise<{data:ClassItemScoreSection[]}>{
 return localStudio(itemId,store=>({data:store.sections.filter(s=>s.itemId===itemId).map((s,index)=>({sectionId:s.id,sectionIndex:index,label:s.score.title,scoreDocument:{id:s.id,title:s.score.title,composer:s.score.composer??null,parsedScore:s.score},tracks:s.score.tracks.map(t=>({...t,id:`${s.id}-track-${t.index}`,trackIndex:t.index})),activeTimeMap:s.timing.waypoints.length?{id:s.id,method:s.timing.method,waypoints:s.timing.waypoints,nudges:[],params:s.timing.params}:null,videoStartSeconds:s.timing.waypoints[0]?.videoTimeSeconds??null,videoEndSeconds:s.timing.waypoints.at(-1)?.videoTimeSeconds??null,metronomeAnchorSeconds:s.timing.anchor?.seconds??null,metronomeAnchorQn:s.timing.anchor?.qn??null,studioDraft:drafts?s.draft:null}))}))
}
export async function addLocalSection(itemId:string,score:ScoreDocument){
 localItem((await readLocalSolfeo()).sections,itemId)
 return localStudio(itemId,store=>{const id='local-solfeo-section-'+randomUUID();store.sections.push({id,itemId,score,timing:{...EMPTY_TIMING},draft:null,versions:[]});return {sectionId:id,scoreDocumentId:id}},true)
}
export async function saveLocalDraft(id:string,score:ScoreDocument,timing:StudioTiming){return localStudio(id,store=>{
 const s=findLocalSection(store,id);const now=new Date().toISOString();s.draft={score,timing,updatedAt:now};s.versions.push({...s.draft,id:'local-solfeo-version-'+randomUUID(),kind:'draft',createdAt:now,isLive:false});s.versions=s.versions.slice(-30);return {updatedAt:now}
},true)}
export const localMediaDefault={trimInSeconds:0,trimOutSeconds:null,bpm:120,anchorSeconds:null}
