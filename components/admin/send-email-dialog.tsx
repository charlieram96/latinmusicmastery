'use client'

import { useEffect, useState, useTransition } from 'react'
import { Loader2, Send } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { EmailImageUpload } from '@/components/admin/email-image-upload'
import { sendWaitlistEmail } from '@/app/actions/email'

const SUBJECT_MAX = 200
const BODY_MAX = 20000
const SIGNATURE_MAX = 2000
const SIGNATURE_KEY = 'lmm:waitlist-email-signature'

type Mode = 'single' | 'selected' | 'all'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: Mode
  ids?: string[]
  recipientCount: number
  recipientPreview?: string
  onSent?: (count: number) => void
}

export function SendEmailDialog({
  open,
  onOpenChange,
  mode,
  ids,
  recipientCount,
  recipientPreview,
  onSent,
}: Props) {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [signature, setSignature] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    if (open) {
      // Prefill the signature with the remembered default (editable per send).
      try {
        setSignature(localStorage.getItem(SIGNATURE_KEY) ?? '')
      } catch {
        // localStorage may be unavailable; fall back to empty.
      }
    } else {
      setSubject('')
      setBody('')
      setImageUrl(null)
      setError(null)
    }
  }, [open])

  const heading =
    mode === 'single'
      ? `Send to ${recipientPreview ?? '1 person'}`
      : mode === 'selected'
        ? `Send to ${recipientCount} selected ${recipientCount === 1 ? 'member' : 'members'}`
        : `Send to all ${recipientCount} waitlist ${recipientCount === 1 ? 'member' : 'members'}`

  const canSubmit = subject.trim().length > 0 && body.trim().length > 0 && !pending

  const handleSubmit = () => {
    setError(null)
    const trimmedSignature = signature.trim()
    startTransition(async () => {
      const res = await sendWaitlistEmail({
        mode,
        ids,
        subject: subject.trim(),
        body: body.trim(),
        imageUrl: imageUrl ?? undefined,
        signature: trimmedSignature || undefined,
      })

      if ('error' in res) {
        setError(res.error)
        return
      }

      // Remember the signature as the default for next time.
      try {
        localStorage.setItem(SIGNATURE_KEY, trimmedSignature)
      } catch {
        // Ignore storage failures.
      }

      onSent?.(res.count)
      onOpenChange(false)
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{heading}</DialogTitle>
          <DialogDescription>
            We&rsquo;ll wrap your message in the Latin Music Mastery branded template before sending.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="email-subject">Subject</Label>
            <Input
              id="email-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject line"
              maxLength={SUBJECT_MAX}
              disabled={pending}
            />
            <div className="text-xs text-muted-foreground text-right">
              {subject.length}/{SUBJECT_MAX}
            </div>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email-body">Message</Label>
            <Textarea
              id="email-body"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write your message. Leave a blank line between paragraphs."
              rows={10}
              maxLength={BODY_MAX}
              disabled={pending}
              className="min-h-[220px]"
            />
            <div className="text-xs text-muted-foreground text-right">
              {body.length}/{BODY_MAX}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Header image (optional)</Label>
            <EmailImageUpload value={imageUrl} onChange={(url) => setImageUrl(url || null)} disabled={pending} />
            <p className="text-xs text-muted-foreground">
              Shown as a banner at the top of the email, under the logo.
            </p>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email-signature">Signature (optional)</Label>
            <Textarea
              id="email-signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="e.g. — The Latin Music Mastery Team"
              rows={4}
              maxLength={SIGNATURE_MAX}
              disabled={pending}
            />
            <div className="text-xs text-muted-foreground text-right">
              Saved as your default • {signature.length}/{SIGNATURE_MAX}
            </div>
          </div>

          {error && (
            <div className="text-sm rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive">
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {pending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Sending…
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Send
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
