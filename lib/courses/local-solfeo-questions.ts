import { publishedContentEnabled } from '@/lib/release/content'
import { readReleaseDocument, writeReleaseDocument } from '@/lib/release/documents'
import {moduleOneQuiz,moduleOneExam} from '@/lib/solfeo/module-one-assessment'
/** Local exercise editing; shared quiz editor never contacts the remote database. */
import { readFile, writeFile, rename } from 'node:fs/promises'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { usesLocalSolfeo, readLocalSolfeo, localItem } from './local-solfeo-draft'
import type { QuizQuestion } from '@/types/modules'
const root=path.join(process.cwd(),'local-artifacts/solfeo-course')
const file=path.join(root,'questions.json')
type Store=Record<string,QuizQuestion[]>
let pending:Promise<unknown>=Promise.resolve()
async function read():Promise<Store>{try{return JSON.parse(publishedContentEnabled()?await readReleaseDocument('local-artifacts/solfeo-course/questions.json'):await readFile(file,'utf8'))}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return {};throw e}}
export async function localQuestions(itemId:string):Promise<QuizQuestion[]>{
 if(!await usesLocalSolfeo(itemId))throw Error('Local exercise unavailable')
 localItem((await readLocalSolfeo()).sections,itemId)
 const store=await read();if(store[itemId])return store[itemId]
 const bookQuiz=itemId.match(/^local-solfeo-m01-c(0[1-8])-quiz$/);if(bookQuiz)return Number(bookQuiz[1])===8?moduleOneExam:moduleOneQuiz(Number(bookQuiz[1]))
 const match=itemId.match(/^(local-solfeo-m\d{2}-c\d{2})-exercise$/)
 if(!match)return []
 try{return JSON.parse((publishedContentEnabled()?await readReleaseDocument('local-artifacts/solfeo-course/production/ready/'+match[1]+'.json'):await readFile(path.join(root,'production/ready',match[1]+'.json'),'utf8'))).questions||[]}catch(e){if((e as NodeJS.ErrnoException).code==='ENOENT')return [];throw e}
}
async function edit<T>(itemId:string,fn:(questions:QuizQuestion[])=>T):Promise<T>{
 if(!await usesLocalSolfeo(itemId))throw Error('Local exercise unavailable')
 const work=pending.then(async()=>{const store=await read();const questions=await localQuestions(itemId);const result=fn(questions);store[itemId]=questions;if(publishedContentEnabled())await writeReleaseDocument('local-artifacts/solfeo-course/questions.json',JSON.stringify(store,null,2));else{await writeFile(file+'.tmp',JSON.stringify(store,null,2));await rename(file+'.tmp',file)};return result})
 pending=work.catch(()=>undefined);return work
}
function fields(input:Partial<QuizQuestion>){const allowed=['question','question_type','options','correct_answer','explanation','audio_url','image_url','question_es','explanation_es','options_es'];return Object.fromEntries(Object.entries(input).filter(([key])=>allowed.includes(key)))}
function owner(id:string){const item=id.split(/-(?:q(?:\d+|-)|listen-\d+)/)[0];if(item===id)throw Error('Unknown local question');return item}
export async function createLocalQuestion(itemId:string,input:Partial<QuizQuestion>){return edit(itemId,questions=>{const data={id:itemId+'-q-'+randomUUID(),class_item_id:itemId,order_index:questions.length,question:'',question_type:'multiple_choice',options:null,correct_answer:null,explanation:null,audio_url:null,image_url:null,question_es:null,explanation_es:null,options_es:null,created_at:null,updated_at:null,...fields(input)} as QuizQuestion;questions.push(data);return {data}})}
export async function updateLocalQuestion(id:string,input:Partial<QuizQuestion>){return edit(owner(id),questions=>{const data=questions.find(q=>q.id===id);if(!data)throw Error('Unknown local question');Object.assign(data,fields(input),{updated_at:new Date().toISOString()});return {data}})}
export async function deleteLocalQuestion(id:string){return edit(owner(id),questions=>{const i=questions.findIndex(q=>q.id===id);if(i<0)throw Error('Unknown local question');questions.splice(i,1);questions.forEach((q,i)=>q.order_index=i);return {success:true}})}
export async function reorderLocalQuestions(itemId:string,ids:string[]){return edit(itemId,questions=>{if(ids.length!==questions.length||new Set(ids).size!==ids.length||ids.some(id=>!questions.some(q=>q.id===id)))throw Error('Invalid question order');questions.sort((a,b)=>ids.indexOf(a.id)-ids.indexOf(b.id));questions.forEach((q,i)=>q.order_index=i);return {success:true}})}
