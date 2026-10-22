'use client'
import { useLearningMode } from '@/components/learning-mode/store'
import { KidCharacter } from '@/components/learning-mode/art'
import { useEffect, useState } from 'react'
import { CommentForm } from '@/components/comments/comment-form'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { MessageSquare } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'
export function LocalLessonCommunity({lessonNumber = 1, classId}: {lessonNumber?: 1 | 2; classId?:string}) {
 const kids=useLearningMode()==='kids'
 const storageKey=classId?`lmm-solfeo-${classId}-comments`:`lmm-solfeo-class${lessonNumber}-comments`
 const {locale}=useTranslation();const es=locale==='es'
 const [comments,setComments]=useState<string[]>([])
 useEffect(()=>{try {setComments(JSON.parse(localStorage.getItem(storageKey)||'[]'))}catch{setComments([])}},[storageKey])
 return <Card className="rounded-2xl border-border bg-raised shadow-warm"><CardHeader><CardTitle className="flex items-center gap-2 font-heading text-lg">{kids?<KidCharacter name="community" className="h-10 w-10"/>:<MessageSquare size={20}/>} {kids?(es?'El rincón de las preguntas':'The question corner'):(es?'Comunidad y comentarios':'Community and comments')}</CardTitle><p className="text-xs text-muted-foreground">{es?'Prueba local: los comentarios se guardan solo en este navegador.':'Local preview: comments are saved only in this browser.'}</p></CardHeader><CardContent className="space-y-5"><CommentForm onSubmit={async content=>{const next=[...comments,content];localStorage.setItem(storageKey,JSON.stringify(next));setComments(next)}}/>{comments.map((comment,i)=><div key={i} className="border-t pt-4"><b className="text-sm">{es?'Tú':'You'}</b><p className="whitespace-pre-wrap text-sm">{comment}</p></div>)}{!comments.length&&<p className="py-4 text-center text-sm text-muted-foreground">{es?'Comparte una pregunta sobre esta clase.':'Share a question about this lesson.'}</p>}</CardContent></Card>
}
