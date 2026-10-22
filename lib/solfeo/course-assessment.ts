import type {QuizQuestion} from '@/types/modules'
export type CourseQuestion={question_es:string;question_en:string;explanation_es:string;explanation_en:string;choices:{es:string;en:string}[];correct:number;audio_url?:string;sourcePage?:number|null;evidence?:string}
export function courseQuestions(book:{id:string;questions?:CourseQuestion[]},locale:string):QuizQuestion[]{
 const es=locale==='es'
 return (book.questions??[]).map((q,i)=>({id:`${book.id}-quiz-q${i+1}`,class_item_id:book.id+'-quiz',order_index:i,question:es?q.question_es:q.question_en,question_es:q.question_es,question_type:q.audio_url?'audio_choice':'multiple_choice',options:{choices:q.choices.map((c,j)=>({id:String(j),text:es?c.es:c.en}))},options_es:{choices:q.choices.map((c,j)=>({id:String(j),text:c.es}))},correct_answer:String(q.correct),explanation:es?q.explanation_es:q.explanation_en,explanation_es:q.explanation_es,audio_url:q.audio_url??null,image_url:null,created_at:null,updated_at:null}))
}
