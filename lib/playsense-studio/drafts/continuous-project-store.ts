import {publishedContentEnabled} from '@/lib/release/content';
import {readReleaseDocument,writeReleaseDocument} from '@/lib/release/documents';
import {headers} from 'next/headers';
import {readFile,writeFile,mkdir,rename} from 'node:fs/promises';
import path from 'node:path';
import type {ContinuousScoreProject} from '../continuous-project';
import type {ClassItemScoreSection} from '@/app/actions/playsense-studio';
import {sectionSeed} from './seed';
const root=path.join(process.cwd(),'local-artifacts/studio-preview');
export async function continuousPreviewEnabled() {
  if(publishedContentEnabled())return true;
  if(process.env.NODE_ENV!=='development')return false;
  return ['localhost','127.0.0.1'].includes((await headers()).get('host')?.split(':')[0]??'');
}
async function readJson(file:string) {try{return JSON.parse(publishedContentEnabled()?await readReleaseDocument('local-artifacts/studio-preview/'+path.relative(root,file).split(path.sep).join('/')):await readFile(file,'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {};throw e;}}
async function saveJson(file:string,data:unknown){const text=JSON.stringify(data,null,2)+'\n';if(publishedContentEnabled())await writeReleaseDocument('local-artifacts/studio-preview/'+path.relative(root,file).split(path.sep).join('/'),text);else{await writeFile(file+'.tmp',text);await rename(file+'.tmp',file);}}
export async function readContinuousProject(id:string):Promise<ContinuousScoreProject|undefined>{
  if(publishedContentEnabled()&&id!=='19d7db0f-a8f7-476e-b1b4-96ccfe923184')return undefined;
 if(!await continuousPreviewEnabled())return undefined;
  const entry=(await readJson(path.join(root,'continuous-projects.json')))[id];
  if(!entry)return undefined;
  const {sections:_,...project}=entry;return project;
}
export async function adoptContinuousProject(id:string,sections:ClassItemScoreSection[],durationSeconds:number){
  if(!await continuousPreviewEnabled())throw new Error('Local preview only');
  const existing=await readContinuousProject(id);if(existing)return existing;
  if(!publishedContentEnabled())await mkdir(path.join(root,'backups'),{recursive:true});
  const draftsFile=path.join(root,'drafts.json');
  const drafts=await readJson(draftsFile);
  const backupPath=path.join(root,'backups',`${id}-${Date.now()}.json`);
  // Complete original sections, maps, anchors, notation and local drafts, before adoption.
  await saveJson(backupPath,{createdAt:new Date().toISOString(),classItemId:id,durationSeconds,sections,localDrafts:drafts});
  for(const section of sections){const seed=sectionSeed(section);drafts[`section:${section.sectionId}`]={score:seed.score,timing:seed.timing,updatedAt:new Date().toISOString()};}
  await saveJson(draftsFile,drafts);
  const project:ContinuousScoreProject={version:1,title:'Relleno mano izquierda cáscara',classItemId:id,sectionIds:sections.map(s=>s.sectionId),durationSeconds,backupPath};
  const projectsFile=path.join(root,'continuous-projects.json');const projects=await readJson(projectsFile);projects[id]={...project,sections};
  await saveJson(projectsFile,projects);
  return project;
}

export async function continuousSections(id:string):Promise<ClassItemScoreSection[]|undefined>{
 if(publishedContentEnabled()&&id!=='19d7db0f-a8f7-476e-b1b4-96ccfe923184')return undefined;
 if(!await continuousPreviewEnabled())return undefined;
 const entry=(await readJson(path.join(root,'continuous-projects.json')))[id];
 if(!entry?.sections)return undefined;
 const {sections:_,...project}=entry;
 return entry.sections.map((s:ClassItemScoreSection)=>({...s,studioDraft:undefined,continuousProject:project}));
}
export async function addContinuousMusic(id:string,score:ClassItemScoreSection['scoreDocument']['parsedScore']){
 const project=await readContinuousProject(id);if(!project)return undefined;
 const file=path.join(root,'continuous-projects.json');const projects=await readJson(file);const entry=projects[id];
 const sectionId=crypto.randomUUID();
 const section={sectionId,sectionIndex:entry.sections.length,label:score.title,videoStartSeconds:null,videoEndSeconds:null,metronomeAnchorSeconds:null,metronomeAnchorQn:null,
 scoreDocument:{id:sectionId,title:score.title,composer:score.composer??null,parsedScore:score},tracks:[],activeTimeMap:null};
 entry.sections.push(section);entry.sectionIds.push(sectionId);
 const draftsFile=path.join(root,'drafts.json');const drafts=await readJson(draftsFile);
 drafts[`section:${sectionId}`]={score,timing:{method:'drag',params:{},waypoints:[],anchor:null},updatedAt:new Date().toISOString()};
 await saveJson(draftsFile,drafts);await saveJson(file,projects);
 return {sectionId,scoreDocumentId:sectionId};
}
export async function editContinuousMusic(sectionId:string,score?:ClassItemScoreSection['scoreDocument']['parsedScore']){
 if(!await continuousPreviewEnabled())return false;
 const file=path.join(root,'continuous-projects.json');const projects=await readJson(file);
 const entry=Object.values(projects).find((p:any)=>p.sectionIds.includes(sectionId)) as any;
 if(!entry)return false;
 if(score){const section=entry.sections.find((s:any)=>s.sectionId===sectionId);section.scoreDocument={...section.scoreDocument,parsedScore:score,title:score.title};section.activeTimeMap=null;section.videoStartSeconds=null;section.videoEndSeconds=null;}
 else{entry.sections=entry.sections.filter((s:any)=>s.sectionId!==sectionId);entry.sectionIds=entry.sectionIds.filter((id:string)=>id!==sectionId);}
 const draftsFile=path.join(root,'drafts.json');const drafts=await readJson(draftsFile);
 if(score)drafts[`section:${sectionId}`]={score,timing:{method:'drag',params:{},waypoints:[],anchor:null},updatedAt:new Date().toISOString()};else delete drafts[`section:${sectionId}`];
 await saveJson(draftsFile,drafts);await saveJson(file,projects);return true;
}

/** Clear only the local merged project, retaining a recoverable snapshot. */
export async function clearContinuousMusic(id:string) {
 if(!await continuousPreviewEnabled())throw new Error('Local preview only');
 const file=path.join(root,'continuous-projects.json');const projects=await readJson(file);const entry=projects[id];
 if(!entry)throw new Error('Continuous project not found');
 const drafts=await readJson(path.join(root,'drafts.json'));
 if(!publishedContentEnabled())await mkdir(path.join(root,'backups'),{recursive:true});
 await saveJson(path.join(root,'backups',`${id}-before-clear-${Date.now()}.json`),{project:entry,localDrafts:drafts});
 // Keep the empty container: falling back to remote sections would resurrect deleted music.
 entry.sections=[];entry.sectionIds=[];
 await saveJson(file,projects);
}
