'use client'

import { AdminText } from '@/components/admin/admin-text'


import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import { deleteStyle } from '@/app/actions/admin'

interface Props {
  styleId: string
  styleName: string
  courseCount: number
}

export function DeleteStyleButton({ styleId, styleName, courseCount }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const blocked = courseCount > 0

  const handleDelete = () => {
    setError(null)
    startTransition(async () => {
      const res = await deleteStyle(styleId)
      if ('error' in res) {
        setError(res.error)
        return
      }
      setOpen(false)
      // Page is a Server Component; revalidatePath happens server-side but
      // router.refresh() makes the new state visible immediately.
      router.refresh()
    })
  }

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={`Delete ${styleName}`}
        title={
          blocked
            ? `Reassign or delete the ${courseCount} course${courseCount === 1 ? '' : 's'} before deleting this style`
            : 'Delete style'
        }
        className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive disabled:text-muted-foreground disabled:hover:bg-transparent"
        disabled={blocked}
        onClick={() => {
          if (blocked) return
          setError(null)
          setOpen(true)
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>

      <Dialog open={open} onOpenChange={(next) => !pending && setOpen(next)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle><AdminText text={"Delete style?"} /></DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2">
                <p> <AdminText text={"This permanently deletes"} />{' '}
                  <span className="font-semibold text-foreground">{styleName}</span>. The style has no
                  associated courses, but it may still be referenced by instruments (the link will be
                  removed) or by waitlist entries (those keep the style id as a stale reference).
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
