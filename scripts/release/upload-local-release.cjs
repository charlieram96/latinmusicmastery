// Explicit, resumable publication. Never reads or uploads arbitrary workspace files.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
require('@next/env').loadEnvConfig(process.cwd());
const {createClient}=require('@supabase/supabase-js');
const c=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}});
const JSZip=require('jszip');
const release='2026-10-22-localhost';
const statePath='/tmp/lmm-release-upload-state.json';const state=fs.existsSync(statePath)?JSON.parse(fs.readFileSync(statePath)):{};
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const inventory=fs.existsSync('/tmp/lmm-release-asset-paths.json')?JSON.parse(fs.readFileSync('/tmp/lmm-release-asset-paths.json')):Object.keys(require('../../lib/release/manifest.json').files).filter(p=>p.startsWith('public/')).map(p=>p.slice(6));
const assets=[...inventory.map(p=>'public'+p),...walk('public/local-course-assets/solfeo/complete-scores'),...walk('public/local-course-assets/audio-replacements'),...walk('public/local-course-assets/codex-ritmo').filter(p=>/\.(jpg|png)$/.test(p))];
const docs=['local-artifacts/studio-preview/published-studio.json','local-artifacts/studio-preview/drafts.json','local-artifacts/studio-preview/continuous-projects.json',...walk('local-artifacts/solfeo-infantil-course').filter(p=>p.endsWith('.json')),
 ...['structure','questions','studio'].map(n=>`local-artifacts/solfeo-course/${n}.json`).filter(p=>fs.existsSync(p)),
 ...walk('local-artifacts/solfeo-course/book-audit').filter(p=>/\/local-solfeo-m\d+-c\d+\.json$/.test(p)),
 ...walk('local-artifacts/solfeo-course/production/ready').filter(p=>p.endsWith('.json')),
 ...walk('local-artifacts/solfeo-course/production/films').filter(p=>p.endsWith('/manifest.json')),
 ...walk('local-artifacts/studio-preview/audio-sources').filter(p=>p.endsWith('.json'))];
const types={'.mp4':'video/mp4','.m4v':'video/mp4','.mp3':'audio/mpeg','.wav':'audio/wav','.flac':'audio/flac','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.vtt':'text/vtt','.json':'application/json','.musicxml':'application/vnd.recordare.musicxml+xml','.mxl':'application/vnd.recordare.musicxml'};
const jobs=[...new Set([...assets,...docs])];let cursor=0,done=0,failed=0;
async function worker(){while(cursor<jobs.length){if(fs.existsSync('/tmp/lmm-release-upload-stop'))break;const file=jobs[cursor++],data=fs.readFileSync(file),sha=crypto.createHash('sha256').update(data).digest('hex');if(state[file]?.sha===sha){done++;continue;}const isAsset=file.startsWith('public/'),type=types[path.extname(file)]||'application/octet-stream',bucket=isAsset?(type.startsWith('video/')?'course-videos':type.startsWith('audio/')?'play-sense-audio':'quiz-media'):'playsense-studio-scores',key=`releases/${release}/${isAsset?file.slice(7):file+'.zip'}`;
 const archive=isAsset?null:new JSZip().file('document.json',data);const payload=archive?await archive.generateAsync({type:'nodebuffer',compression:'DEFLATE'}):data;
 let success=false;for(let attempt=0;attempt<3;attempt++){const {error}=await c.storage.from(bucket).upload(key,payload,{contentType:isAsset?type:'application/zip',upsert:true,cacheControl:isAsset?'31536000':'0'});if(!error){success=true;break;}if(attempt===2)console.log('FAILED',file,error.message);else await new Promise(resolve=>setTimeout(resolve,1500*(attempt+1)));}
 if(success){state[file]={sha,bucket,key,bytes:data.length};fs.writeFileSync(statePath,JSON.stringify(state));done++;}else failed++;
 if((done+failed)%50===0)console.log(JSON.stringify({done,failed,total:jobs.length}));}}
(async()=>{console.log(JSON.stringify({total:jobs.length,assets:assets.length,documents:docs.length}));await Promise.all(Array.from({length:1},worker));console.log(JSON.stringify({done,failed,total:jobs.length}));if(failed)process.exitCode=1;else{fs.mkdirSync('lib/release',{recursive:true});fs.writeFileSync('lib/release/manifest.json',JSON.stringify({release,files:Object.fromEntries(jobs.map(file=>[file,state[file]]))},null,2)+'\n');}})();
