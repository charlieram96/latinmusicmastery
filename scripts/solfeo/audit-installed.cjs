const fs=require('fs'),assert=require('node:assert/strict');
const root='local-artifacts/solfeo-course',prod=root+'/production';
const outline=JSON.parse(fs.readFileSync(root+'/structure.json')),studio=JSON.parse(fs.readFileSync(root+'/studio.json'));
const classes=outline.sections.flatMap(s=>s.classes);assert.equal(classes.length,150);assert.equal(outline.sections.length,12);
let questionCount=0,sectionCount=0;
for(const [index,c]of classes.entries()){
 const video=c.items.find(i=>i.item_type==='VIDEO'),exercise=c.items.find(i=>i.item_type==='EXERCISE');assert(video&&exercise,c.id);
 assert(fs.existsSync('public'+video.video_url),c.id+' media');assert(video.video_duration_seconds>6,c.id+' short clip');
 if(index<2)continue;
 const lesson=JSON.parse(fs.readFileSync(`${prod}/ready/${c.id}.json`));assert.equal(lesson.questions.length,4);questionCount+=lesson.questions.length;
 assert.equal(lesson.nextHref,index<classes.length-1?`/solfeo-preview?class=${classes[index+1].id}`:null);
 for(const q of lesson.questions){assert.equal(q.class_item_id,exercise.id);assert(q.options.choices.some(o=>o.id===q.correct_answer));assert.equal(new Set(q.options.choices.map(c=>c.text)).size,q.options.choices.length);if(q.audio_url)assert(fs.existsSync('public'+q.audio_url));}
 for(const s of lesson.sections){sectionCount++;const persisted=studio.sections.find(z=>z.id===s.id);assert(persisted,c.id+' studio');assert.equal(persisted.itemId,video.id);const wp=s.activeTimeMap.waypoints;assert(wp.length>1);assert(wp[0].videoTimeSeconds>=0&&wp.at(-1).videoTimeSeconds<=lesson.duration);for(let n=1;n<wp.length;n++){assert(wp[n].musicalPositionQN>wp[n-1].musicalPositionQN);assert(wp[n].videoTimeSeconds>wp[n-1].videoTimeSeconds)}}
}
const report={modules:12,classes:150,newMovies:148,newQuestions:questionCount,editableScoreSections:sectionCount,errors:[],localOnly:true};fs.writeFileSync(prod+'/installed-audit.json',JSON.stringify(report,null,2));console.log(report);
