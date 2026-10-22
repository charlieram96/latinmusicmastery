import {publishedContentEnabled} from '@/lib/release/content';
import {readReleaseDocument,writeReleaseDocument} from '@/lib/release/documents';
import {getSupabaseAdmin} from '@/lib/supabase/admin';
import {createHash,randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename} from 'node:fs/promises';
import path from 'node:path';
import {createClient} from '@/lib/supabase/server';
import {requireAdmin} from '@/lib/supabase/require-admin';
import {ORIGINAL_AUDIO,audioClips,type AudioSourceSettings,type AudioClip} from '@/lib/playsense-studio/audio-source';
export const runtime='nodejs';
const root=path.join(process.cwd(),'local-artifacts/studio-preview/audio-sources');
function local(request:Request){const host=new URL(request.url).hostname;return process.env.NODE_ENV==='development'&&['localhost','127.0.0.1'].includes(host);}
function key(item:string,part:string,video:string){
 if(!item||!video||!['watch','exercise'].includes(part)||item.length>200||video.length>4000)throw new Error('Invalid audio source');
 return createHash('sha256').update(JSON.stringify([item,part,video])).digest('hex');
}
async function read(id:string):Promise<AudioSourceSettings>{try{return JSON.parse(publishedContentEnabled()?await readReleaseDocument('local-artifacts/studio-preview/audio-sources/'+id+'.json'):await readFile(path.join(root,id+'.json'),'utf8'));}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return ORIGINAL_AUDIO;throw e;}}
export async function GET(request:Request){
 if(!local(request)&&!publishedContentEnabled())return Response.json(ORIGINAL_AUDIO);
 const client=await createClient();if(!(await client.auth.getUser()).data.user)return Response.json({error:'Unauthorized'},{status:401});
 try{const p=new URL(request.url).searchParams;return Response.json(await read(key(p.get('item')??'',p.get('part')??'',p.get('video')??'')),{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Cannot load audio source'},{status:400});}
}
export async function POST(request:Request){
 if(!local(request)&&!publishedContentEnabled())return Response.json({error:'Audio replacement is available in the local workspace.'},{status:403});
 const origin=request.headers.get('origin');if(origin&&new URL(origin).host!==new URL(request.url).host)return Response.json({error:'Invalid origin'},{status:403});
 const admin=await requireAdmin(await createClient());if('error'in admin)return Response.json({error:admin.error},{status:403});
 try{
  const form=await request.formData();const id=key(String(form.get('item')??''),String(form.get('part')??''),String(form.get('video')??''));
  let settings=await read(id);const file=form.get('file');
  if(file instanceof File){
   const ext=file.name.split('.').pop()?.toLowerCase();
   if(!ext||!['wav','mp3','m4a','aac','ogg','flac','aif','aiff'].includes(ext)||!file.size||file.size>512*1024*1024)return Response.json({error:'Choose an audio file under 512 MB.'},{status:400});
   const duration=Number(form.get('durationSeconds'));const start=Number(form.get('startSeconds')??0);
   if(form.has('durationSeconds')&&(!Number.isFinite(duration)||duration<=0||duration>86400||!Number.isFinite(start)||start<0||start>86400))return Response.json({error:'Invalid clip duration or position'},{status:400});
   const filename=randomUUID()+'.'+ext;
   let url:string;
   if(publishedContentEnabled()){
    const storage=getSupabaseAdmin().storage.from('play-sense-audio'),key='audio-replacements/'+filename;
    const {error}=await storage.upload(key,await file.arrayBuffer(),{contentType:file.type||'application/octet-stream'});
    if(error)throw error;url=storage.getPublicUrl(key).data.publicUrl;
   }else{const dir=path.join(process.cwd(),'public/local-course-assets/audio-replacements');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,filename),Buffer.from(await file.arrayBuffer()));url='/local-course-assets/audio-replacements/'+filename;}
   if(duration>0){
    const existing=audioClips(settings);
    // Legacy whole-file replacements are retained; resolve their duration before adding a layer.
    if(existing.some(c=>!Number.isFinite(c.durationSeconds)))return Response.json({error:'Open the existing audio clip before adding another.'},{status:400});
    settings={...settings,selected:'imported',clips:[...existing.map(c=>({...c,muted:c.muted||settings.selected==='original'})),{id:randomUUID(),url,name:file.name,startSeconds:start,trimStartSeconds:0,trimEndSeconds:duration,durationSeconds:duration,muted:false}]};
   }else settings={selected:'imported',url,name:file.name,offsetSeconds:0};
  }else{
   const selected=form.get('selected');const offset=Number(form.get('offsetSeconds'));
   if(!['original','imported'].includes(String(selected))||!Number.isFinite(offset)||Math.abs(offset)>3600)return Response.json({error:'Invalid audio settings'},{status:400});
   if(form.has('clips')){
    const incoming=JSON.parse(String(form.get('clips'))) as AudioClip[];
    const stored=[...(settings.assets??[]),...audioClips(settings)];const ids=new Set<string>();
    if(!Array.isArray(incoming)||incoming.length>100)throw new Error('Invalid clips');
    for(const clip of incoming){
     const prior=stored.find(c=>c.id===clip.id);
     if(!prior||ids.has(clip.id)||clip.url!==prior.url||clip.name!==prior.name||typeof clip.muted!=='boolean'||![clip.startSeconds,clip.trimStartSeconds,clip.trimEndSeconds,clip.durationSeconds].every(Number.isFinite)||clip.startSeconds<0||clip.startSeconds>86400||clip.trimStartSeconds<0||clip.trimEndSeconds<=clip.trimStartSeconds||clip.trimEndSeconds>clip.durationSeconds||clip.durationSeconds<=0||clip.durationSeconds>86400||(Number.isFinite(prior.durationSeconds)&&clip.durationSeconds!==prior.durationSeconds))throw new Error('Invalid clip');
     ids.add(clip.id);
    }
    settings={...settings,assets:[...new Map([...stored,...incoming].map(c=>[c.id,c])).values()],clips:incoming};
   }
   settings={...settings,originalMuted:form.has('originalMuted')?form.get('originalMuted')==='true':settings.originalMuted,selected:selected as AudioSourceSettings['selected'],offsetSeconds:offset};
  }
  if(publishedContentEnabled())await writeReleaseDocument('local-artifacts/studio-preview/audio-sources/'+id+'.json',JSON.stringify(settings));else{await mkdir(root,{recursive:true});const temp=path.join(root,id+'.'+randomUUID()+'.tmp');await writeFile(temp,JSON.stringify(settings));await rename(temp,path.join(root,id+'.json'));}
  return Response.json(settings);
 }catch{return Response.json({error:'Could not save audio source'},{status:400});}
}
