import type {QuizQuestion,MultipleChoiceOptions} from '@/types/modules'
import source from './module-one-book.json'

// The manual has seven teaching sections, followed by a workshop and a final exam.
// Workshop material belongs to practice, not to extra teaching sections.
export const moduleOneTeachingLessons: {number:number;title:string;pages:import('@/components/solfeo/manual-book-page').ManualPage[];practice:import('@/components/solfeo/manual-book-page').ManualPage[]}[] = source.lessons.slice(0,7).map((lesson,index)=>({
 ...lesson,
 pages:index===2?[...lesson.pages,{title:"Así se escribe la clave de Sol",blocks:[{type:"treble-writing",text:(lesson.pages[0].blocks as {type:string;text?:string}[]).find(b=>b.type==='p')?.text??''}]}]:lesson.pages,
 practice:index===4?[{title:lesson.title,blocks:[
  {type:'h',text:'Identificación de figuras y silencios'},
  ...source.lessons[7].practice[0].blocks.filter(b=>b.type==='diagram'),
  {type:'p',text:'Copia A y escribe el nombre de cada figura. Dibuja al lado el silencio correspondiente. Compara sus duraciones tomando la redonda como referencia.'},
 ]}]:lesson.practice,
}))
function question(id:string,text:string,type:QuizQuestion['question_type'],options:QuizQuestion['options'],answer:string|null,explanation:string):QuizQuestion{
 return {id,class_item_id:id.split('-q')[0],order_index:0,question:text,question_es:text,question_type:type,options,options_es:options as unknown as Record<string,unknown>,correct_answer:answer,explanation,explanation_es:explanation,audio_url:null,image_url:null,created_at:null,updated_at:null}
}
function choice(id:string,text:string,choices:string[],answer:number,explanation:string){return question(id,text,'multiple_choice',{choices:choices.map((text,i)=>({id:String(i),text}))},String(answer),explanation)}
function ordering(id:string,text:string,items:string[],explanation:string){return question(id,text,'ordering_sequence',{items:items.map((text,i)=>({id:String(i),text,correctPosition:i}))},null,explanation)}
const banks = [
 [choice('1a','¿Qué letra corresponde a Do?',['A','C','D'],1,'Do corresponde a C.'),ordering('1b','Ordena los nombres desde Do hasta Si.',['Do','Re','Mi','Fa','Sol','La','Si'],'La serie es Do, Re, Mi, Fa, Sol, La, Si.')],
 [choice('2a','¿Cuántas líneas y espacios interiores tiene el pentagrama?',['5 líneas y 4 espacios','4 líneas y 5 espacios','5 líneas y 5 espacios'],0,'El pentagrama tiene cinco líneas y cuatro espacios interiores.'),choice('2b','¿Desde dónde se cuentan las líneas?',['Arriba','Abajo','Desde la clave'],1,'Se cuentan de abajo hacia arriba.')],
 [choice('3a','¿Qué nota fija la clave de Sol en la segunda línea?',['Mi4','Sol4','Si4'],1,'La clave de Sol fija Sol4 en la segunda línea.'),ordering('3b','Ordena las notas de los espacios de abajo hacia arriba.',['Fa','La','Do','Mi'],'Los espacios son Fa, La, Do y Mi.')],
 [choice('4a','¿Dónde se escribe Do4 en clave de Sol?',['Primera línea adicional inferior','Primer espacio','Tercera línea'],0,'Do4 se escribe en la primera línea adicional inferior.'),choice('4b','¿Para qué sirven las líneas adicionales?',['Cambiar el tempo','Escribir alturas fuera del pentagrama','Indicar silencio'],1,'Extienden el pentagrama para escribir otras alturas.')],
 [ordering('5a','Ordena las figuras de mayor a menor duración.',['Redonda','Blanca','Negra','Corchea','Semicorchea'],'Cada figura dura la mitad de la anterior.'),choice('5b','¿El silencio de blanca dura lo mismo que una blanca?',['Sí','No'],0,'Cada silencio tiene el mismo valor que su figura.')],
 [choice('6a','¿Cuántas corcheas equivalen a una blanca?',['2','4','8'],1,'Una blanca equivale a dos negras o cuatro corcheas.'),choice('6b','¿Cuántas negras equivalen a una redonda?',['2','4','8'],1,'Una redonda equivale a cuatro negras.')],
 [choice('7a','¿Cómo se llama el trazo vertical de una nota?',['Cabeza','Plica','Corchete'],1,'La plica es el trazo vertical unido a la cabeza.'),choice('7b','¿Qué pueden sustituir las barras de unión?',['Las cabezas','Los corchetes de notas agrupadas','Las líneas adicionales'],1,'Las barras unen figuras con corchetes, conservando sus valores.')],
]
export function moduleOneQuiz(number:number):QuizQuestion[]{return (banks[number-1]??[]).map((q,i)=>({...q,id:`local-solfeo-m01-c${String(number).padStart(2,'0')}-quiz-q${i+1}`,class_item_id:`local-solfeo-m01-c${String(number).padStart(2,'0')}-quiz`,order_index:i}))}
export const moduleOneExam:QuizQuestion[]=[
 banks[0][0],banks[1][0],banks[2][0],banks[3][0],banks[4][0],banks[5][0],banks[6][0],
 question('parts','Relaciona las partes de la nota con su función.','matching_pairs',{pairs:[{id:'head',left:'Cabeza',right:'Indica la posición de altura'},{id:'stem',left:'Plica',right:'Trazo vertical unido a la cabeza'},{id:'flag',left:'Corchete',right:'Trazo curvo unido a la plica'}]},null,'Cabeza: posición; plica: trazo vertical; corchete: trazo curvo.'),
 {...choice('ear','Escucha Do4 como referencia y después la segunda nota. ¿La segunda está más aguda, igual o más grave?',['Más aguda','Igual','Más grave'],0,'La segunda nota es Mi4, más aguda que Do4.'),question_type:'audio_choice' as const,audio_url:'/local-course-assets/module-one-exam-do-mi.wav'},
 {...choice('duration','Escucha dos sonidos a negra = 60. El primero es una negra. ¿Qué figura representa el segundo?',['Corchea','Blanca','Redonda'],1,'El segundo dura el doble: dos pulsos, una blanca.'),question_type:'audio_choice' as const,audio_url:'/local-course-assets/module-one-exam-duration.wav'},
].map((q,i)=>({...q,id:`local-solfeo-m01-c08-quiz-q${i+1}`,class_item_id:'local-solfeo-m01-c08-quiz',order_index:i,options:q.question_type==='audio_choice'?{choices:(q.options as MultipleChoiceOptions).choices,optionMode:'text' as const}:q.options}))
