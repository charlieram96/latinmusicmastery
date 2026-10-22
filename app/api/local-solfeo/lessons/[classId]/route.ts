import { readProducedSolfeoLesson } from '@/lib/solfeo/produced-lesson-server'
export async function GET(_request:Request,{params}:{params:Promise<{classId:string}>}){
 const {classId}=await params
 try{const lesson=await readProducedSolfeoLesson(classId);return Response.json(lesson??{error:'Lesson is not ready'},{status:lesson?200:404})}
 catch{return Response.json({error:'Local lesson unavailable'},{status:404})}
}
