import { publishedContentEnabled } from '@/lib/release/content'
import { readReleaseDocument } from '@/lib/release/documents'
import {readFile} from 'node:fs/promises'
import path from 'node:path'
import {usesLocalSolfeo} from '@/lib/courses/local-solfeo-draft'
export async function GET(_request:Request,{params}:{params:Promise<{classId:string}>}){
 const {classId}=await params
 if(!/^local-solfeo-m\d{2}-c\d{2}$/.test(classId)||!await usesLocalSolfeo(classId))return new Response('Not found',{status:404})
 try{return new Response((publishedContentEnabled()?await readReleaseDocument('local-artifacts/solfeo-course/book-audit/'+classId+'.json'):await readFile(path.join(process.cwd(),'local-artifacts/solfeo-course/book-audit',classId+'.json'),'utf8')),{headers:{'Content-Type':'application/json','Cache-Control':'no-store'}})}catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return new Response('Not found',{status:404});throw error}
}
