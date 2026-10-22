import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const state=vi.hoisted(()=>({files:new Map<string,string|Buffer>(),admin:true}));
vi.mock('node:fs/promises',()=>({mkdir:vi.fn(),readFile:vi.fn(async(p:string)=>{if(!state.files.has(p))throw Object.assign(new Error(),{code:'ENOENT'});return state.files.get(p);}),writeFile:vi.fn(async(p:string,value:string|Buffer)=>{state.files.set(p,value);}),rename:vi.fn(async(a:string,b:string)=>{state.files.set(b,state.files.get(a)!);state.files.delete(a);})}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'local-user'}}})}})}));
vi.mock('@/lib/supabase/require-admin',()=>({requireAdmin:async()=>state.admin?{}:{error:'Unauthorized'}}));
import {GET,POST} from '../route';
beforeEach(()=>{state.files.clear();state.admin=true;vi.stubEnv('NODE_ENV','development');});afterEach(()=>vi.unstubAllEnvs());
const url='http://localhost:3000/api/studio-audio-source';
async function update(part:string,file?:File,selected='imported'){
 const form=new FormData();form.set('item','test-item');form.set('part',part);form.set('video','/unchanged.mp4');form.set('selected',selected);form.set('offsetSeconds','.125');if(file)form.set('file',file);
 return POST(new Request(url,{method:'POST',body:form}));
}
it('stores imported audio independently for Watch and Exercise and retains it when original is selected',async()=>{
 const uploaded=await update('watch',new File(['audio bytes'],'corrected.wav',{type:'audio/wav'}));expect(uploaded.status).toBe(200);const source=await uploaded.json();expect(source.selected).toBe('imported');expect(source.url).toContain('/local-course-assets/audio-replacements/');
 const exercise=await GET(new Request(url+'?item=test-item&part=exercise&video=%2Funchanged.mp4'));expect((await exercise.json()).selected).toBe('original');
 const original=await update('watch',undefined,'original');expect(await original.json()).toMatchObject({selected:'original',url:source.url,offsetSeconds:.125});
 expect([...state.files.keys()].some(p=>p.endsWith('unchanged.mp4'))).toBe(false);
});
it('rejects unauthorized edits and non-audio uploads',async()=>{
 state.admin=false;expect((await update('watch',new File(['x'],'a.wav'))).status).toBe(403);state.admin=true;
 expect((await update('watch',new File(['x'],'a.html'))).status).toBe(400);expect(state.files.size).toBe(0);
});
it('appends clips, saves mute and trims without replacing earlier layers, and rejects foreign assets',async()=>{
 const form=()=>{const f=new FormData();f.set('item','clips');f.set('part','watch');f.set('video','/video.mp4');f.set('selected','imported');f.set('offsetSeconds','0');return f;};
 const send=(f:FormData)=>POST(new Request(url,{method:'POST',body:f}));
 const first=form();first.set('file',new File(['test'],'one.wav'));first.set('durationSeconds','30');first.set('startSeconds','60');
 const a=await (await send(first)).json();expect(a.clips).toHaveLength(1);
 const second=form();second.set('file',new File(['test'],'two.wav'));second.set('durationSeconds','20');second.set('startSeconds','95');
 const b=await (await send(second)).json();expect(b.clips).toHaveLength(2);expect(b.clips[0]).toEqual(a.clips[0]);
 const edit=form();edit.set('clips',JSON.stringify([{...b.clips[0],muted:true,trimStartSeconds:5,trimEndSeconds:25},b.clips[1]]));
 const saved=await (await send(edit)).json();expect(saved.clips[0]).toMatchObject({muted:true,startSeconds:60,trimStartSeconds:5,trimEndSeconds:25});expect(saved.clips[1]).toEqual(b.clips[1]);
 edit.set('clips','[]');expect((await send(edit)).status).toBe(200);
 edit.set('clips',JSON.stringify(saved.clips));expect((await send(edit)).status).toBe(200);
 edit.set('clips',JSON.stringify([{...b.clips[0],url:'/foreign.wav'}]));expect((await send(edit)).status).toBe(400);
});
