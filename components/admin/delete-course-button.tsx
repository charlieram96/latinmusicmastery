'use client'

import { useTranslation } from '@/components/language-provider'
import { AdminText } from '@/components/admin/admin-text'


import { useState, useTransition } from 'react'
import { Loader2, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { deleteCourse } from '@/app/actions/admin'

interface Props {
  courseId: string
  courseTitle: string
}

export function DeleteCourseButton({ courseId, courseTitle }: Props) {
  const { locale } = useTranslation()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const res = await deleteCourse(courseId)
      if ('error' in res) {
        setError(res.error)
        return
      }
      setOpen(false)
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`${locale === 'es' ? 'Eliminar' : 'Delete'} ${courseTitle}`}
        title={locale === 'es' ? 'Eliminar curso' : 'Delete course'}
        className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
        onClick={() => {
          setError(null)
          setOpen(true)
        }}
      >
        <Trash2 className="h-4 w-4" />
      </Button>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle><AdminText text={"Delete course?"} /></DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p> <AdminText text={"This permanently deletes"} />{' '}
                  <span className="font-semibold text-foreground">{courseTitle}</span>{locale === 'es'
                    ? ' — todos sus módulos, clases y contenido, además del progreso y la inscripción de los estudiantes en este curso.'
                    : ' — all its sections, classes, and content, plus every student’s progress and enrollment for this course.'}
                </p>
                <p className="font-medium text-destructive"><AdminText text={"This cannot be undone."} /></p>
              </div>
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}> <AdminText text={"Cancel"} /> </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> <AdminText text={"Deleting…"} /> </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" /> <AdminText text={"Delete"} /> </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
