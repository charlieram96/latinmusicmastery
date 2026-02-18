'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'

interface ClassEditorDialogProps {
  isOpen: boolean
  onClose: () => void
  onSave: (title: string, description: string) => Promise<void>
  initialTitle?: string
  initialDescription?: string
  mode: 'create' | 'edit'
}

export function ClassEditorDialog({
  isOpen,
  onClose,
  onSave,
  initialTitle = '',
  initialDescription = '',
  mode,
}: ClassEditorDialogProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTitle(initialTitle)
      setDescription(initialDescription)
    }
  }, [isOpen, initialTitle, initialDescription])

  const handleSave = async () => {
    if (!title.trim()) return

    setSaving(true)
    try {
      await onSave(title, description)
      onClose()
    } catch (err) {
      console.error('Error saving class:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'create' ? 'Add Class' : 'Edit Class'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="class-title">Title</Label>
            <Input
              id="class-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Class title"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="class-description">Description</Label>
            <Textarea
              id="class-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Brief description of this class..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !title.trim()}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
