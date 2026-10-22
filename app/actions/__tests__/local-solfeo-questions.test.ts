import { beforeEach,afterEach,expect,it,vi } from 'vitest'
import outline from '@/local-artifacts/solfeo-course/structure.json'
import lesson from '@/local-artifacts/solfeo-course/production/ready/local-solfeo-m01-c03.json'
const mocks=vi.hoisted(()=>({host:'localhost:3000',files:new Map<string,string>(),remote:vi.fn()}))
vi.mock('next/headers',()=>({headers:async()=>new Headers({host:mocks.host})}))
vi.mock('next/cache',()=>({revalidatePath:vi.fn()}))
vi.mock('@/lib/supabase/server',()=>({createClient:mocks.remote}))
vi.mock('node:fs/promises',()=>({readFile:async(p:string)=>{const s=mocks.files.get(p);if(s===undefined)throw Object.assign(Error('Missing'),{code:'ENOENT'});return s},writeFile:async(p:string,s:string)=>{mocks.files.set(p,s)},rename:async(a:string,b:string)=>{mocks.files.set(b,mocks.files.get(a)!);mocks.files.delete(a)}}))
import {getQuizQuestions,updateQuizQuestion,createQuizQuestion,reorderQuizQuestions,deleteQuizQuestion} from '../quiz'
const root=process.cwd()+'/local-artifacts/solfeo-course',item='local-solfeo-m01-c03-exercise'
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv('NODE_ENV','development');mocks.host='localhost:3000';mocks.files.clear();mocks.files.set(root+'/structure.json',JSON.stringify(outline));mocks.files.set(root+'/production/ready/local-solfeo-m01-c03.json',JSON.stringify(lesson))})
afterEach(()=>vi.unstubAllEnvs())
it('edits Spanish feedback locally and preserves the English variant and source package',async()=>{const original=lesson.questions[0];await updateQuizQuestion(original.id,{explanation_es:'Sol 4 fija la segunda línea'});const q=(await getQuizQuestions(item)).data[0];expect(q.explanation_es).toBe('Sol 4 fija la segunda línea');expect(q.explanation).toBe(original.explanation);expect(JSON.parse(mocks.files.get(root+'/production/ready/local-solfeo-m01-c03.json')!).questions[0]).toEqual(original);expect(mocks.remote).not.toHaveBeenCalled()})
it('creates, reorders and deletes an exercise question without a remote write',async()=>{const created=await createQuizQuestion(item,{question:'Prueba'});expect(created.data).toBeDefined();let ids=(await getQuizQuestions(item)).data.map(q=>q.id).reverse();await reorderQuizQuestions(item,ids);expect((await getQuizQuestions(item)).data[0].id).toBe(created.data!.id);await deleteQuizQuestion(created.data!.id);expect((await getQuizQuestions(item)).data).toHaveLength(4);expect(mocks.remote).not.toHaveBeenCalled()})
it('rejects an invalid reorder without losing questions',async()=>{await expect(reorderQuizQuestions(item,[])).rejects.toThrow('Invalid question order');expect((await getQuizQuestions(item)).data).toHaveLength(4)})
it('does not permit the local exercise adapter on a public host',async()=>{mocks.host='latinmusicmastery.com';await expect(getQuizQuestions(item)).rejects.toThrow('only on localhost');expect(mocks.remote).not.toHaveBeenCalled()})
