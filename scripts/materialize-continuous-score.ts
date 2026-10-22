/** Local pilot migration. Run with vite-node --config vitest.config.ts. */
import {readFile,writeFile,rename,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {padContinuousSection} from '../lib/playsense-studio/continuous-editable';
const root=path.join(process.cwd(),'local-artifacts/studio-preview');
const file=path.join(root,'continuous-projects.json'),draftFile=path.join(root,'drafts.json');
const projects=JSON.parse(await readFile(file,'utf8')),drafts=JSON.parse(await readFile(draftFile,'utf8'));
const id='19d7db0f-a8f7-476e-b1b4-96ccfe923184',project=projects[id];
if(!project||project.editableEmptyMeasures)throw new Error('Pilot absent or already migrated');
const ordered=project.sections.map((section:any)=>({section,draft:drafts[`section:${section.sectionId}`]})).sort((a:any,b:any)=>a.draft.timing.waypoints[0].videoTimeSeconds-b.draft.timing.waypoints[0].videoTimeSeconds);
if(ordered.length!==2)throw new Error('Expected two authored fragments');
await mkdir(path.join(root,'backups'),{recursive:true});
const backup=path.join(root,'backups',`${id}-before-editable-${Date.now()}.json`);
await writeFile(backup,JSON.stringify({projects,localDrafts:drafts},null,2)+'\n',{flag:'wx'});
project.musicRanges={};
for(let i=0;i<ordered.length;i++){
 const {section,draft}=ordered[i];
 const start=draft.timing.waypoints[0].videoTimeSeconds,end=draft.timing.waypoints.at(-1).videoTimeSeconds;
 project.musicRanges[section.sectionId]={start,end};
 const next=i===ordered.length-1?project.durationSeconds:ordered[i+1].draft.timing.waypoints[0].videoTimeSeconds;
 const padded=padContinuousSection(draft.score,draft.timing,i===0?0:start,next);
 // Check every authored point and original note payload before replacing anything.
 const offset=padded.before*(draft.score.initialTimeSignature[0]*4/draft.score.initialTimeSignature[1]);
 for(const point of draft.timing.waypoints){
  const found=padded.timing.waypoints.find(p=>p.musicalPositionQN===point.musicalPositionQN+offset);
  if(!found||found.videoTimeSeconds!==point.videoTimeSeconds)throw new Error('Media anchor changed');
 }
 draft.score.tracks.forEach((track:any,t:number)=>track.measures.forEach((m:any,j:number)=>{
  if(JSON.stringify(m.voices)!==JSON.stringify(padded.score.tracks[t].measures[j+padded.before].voices))throw new Error('Notes changed');
 }));
 drafts[`section:${section.sectionId}`]={...draft,score:padded.score,timing:padded.timing,updatedAt:new Date().toISOString()};
 section.scoreDocument.parsedScore=padded.score;
 section.videoStartSeconds=padded.timing.waypoints[0].videoTimeSeconds;
 section.videoEndSeconds=padded.timing.waypoints.at(-1)!.videoTimeSeconds;
 section.metronomeAnchorSeconds=padded.timing.anchor?.seconds??null;
 section.metronomeAnchorQn=padded.timing.anchor?.qn??null;
 section.activeTimeMap={id:'local-continuous',method:padded.timing.method,params:padded.timing.params,waypoints:padded.timing.waypoints};
 console.log(`${section.sectionId}: ${padded.before} leading, ${padded.after} trailing editable measures`);
}
project.editableEmptyMeasures=true;
await writeFile(draftFile+'.tmp',JSON.stringify(drafts,null,2)+'\n');await rename(draftFile+'.tmp',draftFile);
await writeFile(file+'.tmp',JSON.stringify(projects,null,2)+'\n');await rename(file+'.tmp',file);
console.log(`Backup: ${backup}; all original note data and media timestamps verified`);
