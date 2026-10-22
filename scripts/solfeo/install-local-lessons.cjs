// Explicit selected IDs only. Local files, recoverable backups, never a remote DB.
const fs=require('node:fs'),path=require('node:path');
const root='local-artifacts/solfeo-course',prod=root+'/production';
const ids=process.argv.slice(2);if(!ids.length)throw Error('Pass reviewed class IDs');
if(ids.some(id=>!/^local-solfeo-m\d{2}-c\d{2}$/.test(id)||['local-solfeo-m01-c01','local-solfeo-m01-c02'].includes(id)))throw Error('Invalid selection or protected approved class');
const structure=JSON.parse(fs.readFileSync(root+'/structure.json')),studio=JSON.parse(fs.readFileSync(root+'/studio.json'));
const ready=prod+'/ready',assets='public/local-course-assets/solfeo/films';fs.mkdirSync(ready,{recursive:true});fs.mkdirSync(assets,{recursive:true});
const packages=ids.map(id=>JSON.parse(fs.readFileSync(`${prod}/staged/${id}.json`)));
for(const lesson of packages){
 if(fs.existsSync(`${ready}/${lesson.classId}.json`))throw Error('Already installed; preserve local editing: '+lesson.classId);
 const c=structure.sections.flatMap(s=>s.classes).find(c=>c.id===lesson.classId);if(!c)throw Error('Unknown course class');
 if(c.items.some(i=>i.item_type==='VIDEO'))throw Error('Existing video must be reviewed before replacement: '+c.id);
}
const backup=prod+'/backups/'+new Date().toISOString().replace(/[:.]/g,'-');fs.mkdirSync(backup,{recursive:true});for(const f of ['structure.json','studio.json'])fs.copyFileSync(root+'/'+f,backup+'/'+f);
for(const lesson of packages){
 const id=lesson.classId,c=structure.sections.flatMap(s=>s.classes).find(c=>c.id===id),template=structure.sections[0].classes[0].items.find(i=>i.item_type==='VIDEO');
 c.items.forEach((item,i)=>{item.order_index=i+1});
 c.items.unshift({...template,id:id+'-video',class_id:id,title:lesson.title.en,title_es:lesson.title.es,video_url:lesson.videoUrl,video_duration_seconds:Math.round(lesson.duration),order_index:0});
 for(const section of lesson.sections){if(studio.sections.some(s=>s.id===section.id))throw Error('Section ID conflict');studio.sections.push({id:section.id,itemId:id+'-video',score:section.score,timing:{method:'drag',params:{},waypoints:section.activeTimeMap.waypoints,anchor:null},draft:null,versions:[]})}
 studio.media[id+'-video']={trimInSeconds:0,trimOutSeconds:null,bpm:96,anchorSeconds:null};
 fs.copyFileSync(`${prod}/films/${id}/lesson.mp4`,`${assets}/${id}.mp4`);fs.copyFileSync(`${prod}/films/${id}/000.png`,`${assets}/${id}.png`);
 fs.writeFileSync(`${ready}/${id}.json`,JSON.stringify(lesson,null,2));
}
for(const [name,data]of [['studio.json',studio],['structure.json',structure]]){fs.writeFileSync(root+'/'+name+'.install.tmp',JSON.stringify(data,null,2)+'\n');fs.renameSync(root+'/'+name+'.install.tmp',root+'/'+name)}
console.log('Installed locally:',ids.join(', '),'Backup:',backup);
