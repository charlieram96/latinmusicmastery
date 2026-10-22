// Preserve picture timestamps and synchronize a continuous audio stream to them.
// Versioned outputs and store backups keep this local migration reversible.
const fs=require('node:fs'),path=require('node:path'),{execFileSync:run}=require('node:child_process');
const root='local-artifacts/solfeo-course',prod=root+'/production',ff='/Users/raffymac/bin/ffmpeg',probe='/Users/raffymac/bin/ffprobe';
const read=p=>JSON.parse(fs.readFileSync(p)),save=(p,v)=>{fs.writeFileSync(p+'.tmp',JSON.stringify(v,null,2));fs.renameSync(p+'.tmp',p)};
const backup=prod+'/backups/continuous-audio';fs.mkdirSync(backup,{recursive:true});
if(!fs.existsSync(backup+'/structure.json'))fs.copyFileSync(root+'/structure.json',backup+'/structure.json');
const classes=read(root+'/structure.json').sections.flatMap(s=>s.classes),report=[];
for(const c of classes){
 const readyPath=prod+'/ready/'+c.id+'.json';if(!fs.existsSync(readyPath))continue;
 const ready=read(readyPath),item=c.items.find(i=>i.item_type==='VIDEO');
 const dest='/local-course-assets/solfeo/films/'+c.id+'-sync-v2.mp4';
 if(!fs.existsSync('public'+dest)){
  run(ff,['-y','-i','public'+item.video_url,'-map','0:v:0','-map','0:a:0','-c:v','copy','-af','aresample=48000:async=1:first_pts=0','-c:a','aac','-b:a','192k','-movflags','+faststart','public'+dest],{stdio:'pipe'});
 }
 const packets=readProbe('public'+dest),original=readProbe('public'+item.video_url);
 const gaps=p=>p.slice(1).map((x,i)=>Number(x.pts_time)-Number(p[i].pts_time)-Number(p[i].duration_time)).filter(g=>Math.abs(g)>.001);
 if(gaps(packets).length)throw Error('Audio still discontinuous: '+c.id);
 const structure=read(root+'/structure.json'),live=structure.sections.flatMap(s=>s.classes).find(x=>x.id===c.id).items.find(i=>i.item_type==='VIDEO');
 if(!fs.existsSync(backup+'/'+c.id+'.json'))fs.copyFileSync(readyPath,backup+'/'+c.id+'.json');
 live.video_url=dest;ready.videoUrl=dest;save(readyPath,ready);save(root+'/structure.json',structure);
 report.push({id:c.id,previousUrl:item.video_url,url:dest,previousDiscontinuities:gaps(original).length,discontinuities:0});
 save(prod+'/continuous-audio-report.json',report);console.log(c.id, 'normalized; prior gaps:',gaps(original).length);
}
function readProbe(file){return JSON.parse(run(probe,['-v','error','-select_streams','a:0','-show_packets','-show_entries','packet=pts_time,duration_time','-of','json',file],{maxBuffer:50*1024*1024})).packets}
