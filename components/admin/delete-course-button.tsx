'use client'

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
        aria-label={`Delete ${courseTitle}`}
        title="Delete course"
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
            <DialogTitle>Delete course?</DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p>
                  This permanently deletes{' '}
                  <span className="font-semibold text-foreground">{courseTitle}</span> — all its sections, classes,
                  and content, plus every student&rsquo;s progress and enrollment for this course.
                </p>
                <p className="font-medium text-destructive">This cannot be undone.</p>
              </div>
            </DialogDescription>
          </DialogHeader>

          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={pending}>
              {pending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
