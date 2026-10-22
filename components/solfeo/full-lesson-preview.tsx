'use client'

import { useTranslation } from '@/components/language-provider'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { FirstSolfeoDocumentLesson } from './first-document-lesson'
import {moduleOneLessons} from './manual-book-page'

/** The same interactive lesson in authoring and student preview; no duplicate lesson state. */
export function FullSolfeoLessonPreview({lessonNumber = 1, exercise = false}: {lessonNumber?: number; exercise?: boolean}) {
  const { locale } = useTranslation()
  const es = locale === 'es'
  return <Dialog>
    <DialogTrigger asChild><Button variant="outline">{exercise?(es?'Abrir ejercicios':'Open exercises'):(es ? 'Abrir clase interactiva completa' : 'Open complete interactive lesson')}</Button></DialogTrigger>
    <DialogContent className="max-h-[94dvh] overflow-y-auto sm:max-w-6xl">
      <DialogTitle>{moduleOneLessons[lessonNumber-1].title}</DialogTitle>
      <DialogDescription>{es ? 'La lección incluye introducción, explicación y cierre. La práctica está en Ejercicio.' : 'The lesson includes introduction, explanation and completion. Practice is in Exercise.'}</DialogDescription>
      <FirstSolfeoDocumentLesson lessonNumber={lessonNumber} exercise={exercise} />
    </DialogContent>
  </Dialog>
}
