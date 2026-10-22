import type { QuizQuestion } from '@/types/modules'

/** Exercise content only; uses the platform's existing grading and feedback UI. */
export function solfeoExerciseQuestions(lesson: 1 | 2, es: boolean): QuizQuestion[] {
  const letters = ['C','D','E','F','G','A','B']
  const prompts = lesson === 1
    ? ['Do','Mi','Sol','Si'].map((note,i) => ({text: es?`¿Qué letra corresponde a ${note}?`:`Which letter corresponds to ${note}?`, choices:letters, answer:[0,2,4,6][i]}))
    : [
      {text:es?'¿Cuántas líneas tiene el pentagrama?':'How many lines are in a staff?',choices:['4','5','6'],answer:1},
      {text:es?'¿Cuántos espacios interiores tiene?':'How many inner spaces does it have?',choices:['3','4','5'],answer:1},
      {text:es?'¿Dónde está la primera línea?':'Where is the first line?',choices:es?['Abajo','Arriba','En el centro']:['At the bottom','At the top','In the middle'],answer:0},
      {text:es?'¿Qué signo fija la referencia para nombrar las notas?':'Which sign establishes the reference for naming notes?',choices:es?['La barra final','El silencio','La clave']:['The final barline','The rest','The clef'],answer:2},
    ]
  const item=`local-solfeo-m01-c0${lesson}-exercise`
  return prompts.map((p,i)=>({id:`${item}-q${i+1}`,class_item_id:item,order_index:i,question:p.text,question_type:'multiple_choice',options:{choices:p.choices.map((text,j)=>({id:String(j),text}))},correct_answer:String(p.answer),explanation:es?`Respuesta correcta: ${p.choices[p.answer]}.`:`Correct answer: ${p.choices[p.answer]}.`,question_es:null,explanation_es:null,options_es:null,audio_url:null,image_url:null,created_at:null,updated_at:null}))
}
