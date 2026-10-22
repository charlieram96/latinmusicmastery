import {publishedContentEnabled} from '@/lib/release/content'
import {getSupabaseAdmin} from '@/lib/supabase/admin'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { usesLocalSolfeo, localItem, readLocalSolfeo } from '@/lib/courses/local-solfeo-draft'
import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/supabase/require-admin'
export async function POST(request:Request){
 const origin=request.headers.get('origin')
 if(origin && new URL(origin).host!==request.headers.get('host'))return Response.json({error:'Invalid origin'},{status:403})
 const form=await request.formData(),id=String(form.get('itemId')??'')
 if(!await usesLocalSolfeo(id))return Response.json({error:'Local only'},{status:403})
 const admin=await requireAdmin(await createClient())
 if('error' in admin)return Response.json({error:admin.error},{status:403})
 localItem((await readLocalSolfeo()).sections,id)
 const file=form.get('file')
 if(!(file instanceof File))return Response.json({error:'Missing file'},{status:400})
 const ext=file.name.split('.').at(-1)?.toLowerCase()
 if(!ext||!['mp4','webm','mov','vtt','mp3','wav','ogg','m4a','jpg','jpeg','png','webp','gif'].includes(ext)||file.size>(ext==='vtt'?1024*1024:1024*1024*1024))return Response.json({error:'Invalid file'},{status:400})
 const name=`${randomUUID()}.${ext}`,dir=path.join(process.cwd(),'public/local-course-assets/media')
 if(publishedContentEnabled()){
  const bucket=['mp4','webm','mov'].includes(ext)?'course-videos':['mp3','wav','ogg','m4a'].includes(ext)?'play-sense-audio':ext==='vtt'?'lesson-subtitles':'quiz-media'
  const storage=getSupabaseAdmin().storage.from(bucket),key='authored-solfeo/'+name
  const type=ext==='mov'?'video/quicktime':ext==='vtt'?'text/vtt':file.type||'application/octet-stream'
  const {error}=await storage.upload(key,await file.arrayBuffer(),{contentType:type})
  if(error)return Response.json({error:'Unable to upload media'},{status:500})
  return Response.json({url:storage.getPublicUrl(key).data.publicUrl})
 }
 await mkdir(dir,{recursive:true});await writeFile(path.join(dir,name),Buffer.from(await file.arrayBuffer()))
 return Response.json({url:`/local-course-assets/media/${name}`})
}
