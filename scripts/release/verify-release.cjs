const fs=require('node:fs'),crypto=require('node:crypto'),JSZip=require('jszip');
require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');
const client=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const manifest=require('../../lib/release/manifest.json');
(async()=>{
 const documents=['local-artifacts/solfeo-infantil-course/structure.json','local-artifacts/solfeo-infantil-course/books/local-solfeo-kids-m02-c01.json','local-artifacts/studio-preview/published-studio.json'];
 for(const file of documents){const e=manifest.files[file];const {data,error}=await client.storage.from(e.bucket).download(e.key);if(error)throw error;const zip=await JSZip.loadAsync(await data.arrayBuffer());const bytes=await zip.file('document.json').async('nodebuffer');if(crypto.createHash('sha256').update(bytes).digest('hex')!==e.sha)throw Error('Checksum mismatch: '+file);console.log('Verified private document:',file);}
 const media=['public/local-course-assets/codex-variaciones/preview.mp4','public/local-course-assets/codex-variaciones/dub-en-original-percussion.flac','public/local-course-assets/solfeo/complete-scores/estudio-completo-01.musicxml'];
 for(const file of media){const e=manifest.files[file];const url=client.storage.from(e.bucket).getPublicUrl(e.key).data.publicUrl;const r=await fetch(url,{headers:{Range:'bytes=0-31'}});if(!r.ok)throw Error('Media inaccessible: '+file);const bytes=Buffer.from(await r.arrayBuffer());const local=fs.openSync(file,'r'),prefix=Buffer.alloc(32);fs.readSync(local,prefix,0,32,0);fs.closeSync(local);if(!bytes.subarray(0,32).equals(prefix))throw Error('Media prefix mismatch: '+file);console.log('Verified media and range:',file,r.status);}
 const {error}=await client.from('courses').select('id').limit(1);if(error)throw error;console.log('Database access verified.');
})().catch(e=>{console.error(e.message);process.exitCode=1;});
