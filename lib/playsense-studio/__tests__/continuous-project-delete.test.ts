import {describe,it,expect,vi,beforeEach} from 'vitest';
import path from 'node:path';
const files=vi.hoisted(()=>new Map<string,string>());
vi.mock('next/headers',()=>({headers:async()=>new Headers({host:'localhost:3000'})}));
vi.mock('node:fs/promises',()=>({
 readFile:vi.fn(async(p:string)=>{if(!files.has(p))throw Object.assign(new Error('missing'),{code:'ENOENT'});return files.get(p);}),
 writeFile:vi.fn(async(p:string,value:string)=>{files.set(p,value);}),
 mkdir:vi.fn(async()=>{}),
 rename:vi.fn(async(a:string,b:string)=>{files.set(b,files.get(a)!);files.delete(a);}),
}));
import {clearContinuousMusic,continuousSections} from '../drafts/continuous-project-store';
describe('local continuous project deletion',()=>{
 beforeEach(()=>{files.clear();vi.stubEnv('NODE_ENV','development');});
 it('backs up the whole project and retains an empty container without deleting other music',async()=>{
 const root=path.join(process.cwd(),'local-artifacts/studio-preview');
 const original={pilot:{sectionIds:['a','b'],sections:[{sectionId:'a'},{sectionId:'b'}]},other:{sectionIds:['c'],sections:[{sectionId:'c'}]}};
 const drafts={'section:a':{score:{title:'Original'},timing:{anchor:{seconds:7.6}}}};
 files.set(root+'/continuous-projects.json',JSON.stringify(original));files.set(root+'/drafts.json',JSON.stringify(drafts));
 await clearContinuousMusic('pilot');
 const after=JSON.parse(files.get(root+'/continuous-projects.json')!);
 expect(after.pilot.sections).toEqual([]);expect(after.other).toEqual(original.other);
 expect(await continuousSections('pilot')).toEqual([]);
 const backup=[...files.entries()].find(([name])=>name.includes('before-clear'))!;
 expect(JSON.parse(backup[1])).toEqual({project:original.pilot,localDrafts:drafts});
 expect(JSON.parse(files.get(root+'/drafts.json')!)).toEqual(drafts);
 });
});
