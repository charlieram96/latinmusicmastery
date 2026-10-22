'use server';
import {createClient} from '@/lib/supabase/server';
import {requireAdmin} from '@/lib/supabase/require-admin';
import {getStudioScoreSectionsForClassItem} from './playsense-studio';
import {adoptContinuousProject,readContinuousProject,clearContinuousMusic} from '@/lib/playsense-studio/drafts/continuous-project-store';
export async function getContinuousScoreProject(id:string){return readContinuousProject(id);}
export async function startContinuousScoreProject(id:string,duration:number){
  const admin=await requireAdmin(await createClient());if('error' in admin)return {error:admin.error};
  if(id!=='19d7db0f-a8f7-476e-b1b4-96ccfe923184')return {error:'This pilot is limited to the selected activity.'};
  if(!Number.isFinite(duration)||duration<=0)return {error:'Wait for video duration before merging.'};
  const result=await getStudioScoreSectionsForClassItem(id);if(result.error||!result.data?.length)return {error:result.error??'No scores'};
  try{return {project:await adoptContinuousProject(id,result.data,duration)};}catch(e){return {error:e instanceof Error?e.message:'Could not create backup'};}
}

export async function deleteContinuousScoreProject(id:string){
 const admin=await requireAdmin(await createClient());if('error' in admin)return {error:admin.error};
 try{await clearContinuousMusic(id);return {};}catch(e){return {error:e instanceof Error?e.message:'Could not clear project'};}
}
