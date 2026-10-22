'use client'
import {bookText} from '@/lib/solfeo/book-translation'
import type { ReactNode } from 'react'
import { LearningModeToggle } from '@/components/learning-mode-toggle'
import { ThemeToggle } from '@/components/theme-toggle'
import { LanguageToggle } from '@/components/language-toggle'
import { useTranslation } from '@/components/language-provider'

export interface LessonHeaderContext { title: string; module: string; courseTitle?:string; editorLinks?: ReactNode }

/** Shared compact heading for local student lessons and authoring previews. */
export function LessonHeader({title,context,tabs,settings}:{title:string;context?:LessonHeaderContext;tabs:ReactNode;settings?:ReactNode}) {
 const {locale}=useTranslation(),es=locale==='es'
 return <header className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b bg-background px-4 py-3" aria-label={es?'Cabecera de la clase':'Lesson header'}>
  <div className="min-w-0 flex-1 basis-60">
   <p className="text-xs text-muted-foreground">{context?.courseTitle??(es?'Solfeo Aplicado':'Applied Solfege')}{context?.module ? ` › ${bookText(context.module,locale)}` : ''}</p>
   <h1 className="font-heading text-base font-bold leading-snug">{bookText(context?.title??title,locale)}</h1>
  </div>
  {tabs}
  <div className="flex items-center gap-1">
   <LearningModeToggle variant="icon"/><ThemeToggle/><LanguageToggle/>{settings}
   {context?.editorLinks&&<details className="relative"><summary className="cursor-pointer rounded-lg border px-3 py-2 text-xs font-semibold text-primary">{es?'Editor':'Editor'}</summary><nav aria-label={es?'Volver al editor':'Return to editor'} className="absolute right-0 z-40 mt-2 grid w-64 gap-3 rounded-xl border bg-background p-4 shadow-lg">{context.editorLinks}</nav></details>}
  </div>
 </header>
}
