import english from './book-en.json'
import type {QuizQuestion} from '@/types/modules'

const translations:Record<string,string>=english
/** Authored text only: pitches, notation paths, answers and playback data stay untouched. */
export function bookText(text:string,locale:string):string {
 if(locale==='es')return text
 return translations[text.trim()]??text
}
export function bookSvg(svg:string,locale:string):string {
 if(locale==='es')return svg
 return svg.replace(/(<text\b[^>]*>)([\s\S]*?)(<\/text>)/g,(_,open,body,close)=>open+bookText(body,locale)+close)
}
function optionsText(value:unknown,locale:string):unknown {
 if(Array.isArray(value))return value.map(v=>optionsText(v,locale))
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).map(([key,v])=>[key,['text','left','right'].includes(key)&&typeof v==='string'?bookText(v,locale):optionsText(v,locale)]))
 return value
}
export function bookQuestions(questions:QuizQuestion[],locale:string):QuizQuestion[]{
 if(locale==='es')return questions
 return questions.map(q=>({...q,question:bookText(q.question,'en'),explanation:q.explanation?bookText(q.explanation,'en'):q.explanation,options:optionsText(q.options,'en') as QuizQuestion['options']}))
}
