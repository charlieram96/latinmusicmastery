'use client'

import { useState, useEffect } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { VideoUpload } from './video-upload'
import { QuizBuilder } from './quiz-builder'
import { JamSessionEditor } from './jam-session-editor'
import { TiptapEditor } from './tiptap-editor'
import { ClassItem, ClassItemType, QuestionType } from '@/types/modules'
import { updateClassItem } from '@/app/actions/course-builder'

interface ClassItemEditorPanelProps {
  item: ClassItem | null
  isOpen: boolean
  onClose: () => void
  onSaved: (item: ClassItem) => void
}

const itemTypeLabels: Record<string, string> = {
  VIDEO: 'Video',
  QUIZ: 'Quiz',
  EXERCISE: 'Exercise',
  JAM_SESSION: 'Jam Session',
}

export function ClassItemEditorPanel({
  item,
  isOpen,
  onClose,
  onSaved,
}: ClassItemEditorPanelProps) {
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Partial<ClassItem>>({})

  // Reset formData when item changes
  useEffect(() => {
    if (item) {
      setFormData({
        ...item,
      })
    } else {
      setFormData({})
    }
  }, [item, isOpen])

  const handleSave = async () => {
    if (!item || !formData.title) return

    setSaving(true)
    try {
      // Build updates based on item_type
      const updates: Record<string, unknown> = {
        title: formData.title,
        description: formData.description || null,
        rich_content: formData.rich_content || null,
      }

      if (item.item_type === 'VIDEO') {
        updates.video_url = formData.video_url || null
        updates.video_duration_seconds = formData.video_duration_seconds || null
        updates.soundslice_embed_url = formData.soundslice_embed_url || null
      }

      if (item.item_type === 'QUIZ' || item.item_type === 'EXERCISE') {
        updates.question = formData.question || null
        updates.question_type = formData.question_type || null
        updates.options = formData.options || null
        updates.correct_answer = formData.correct_answer || null
        updates.explanation = formData.explanation || null
      }

      if (item.item_type === 'JAM_SESSION') {
        updates.audio_url = formData.audio_url || null
        updates.bpm = formData.bpm || null
        updates.key_signature = formData.key_signature || null
      }

      const result = await updateClassItem(item.id, updates)

      if (result.error) {
        console.error('Error saving class item:', result.error)
        return
      }

      onSaved(result.data as ClassItem)
      onClose()
    } catch (err) {
      console.error('Error saving class item:', err)
    } finally {
      setSaving(false)
    }
  }

  if (!item) return null

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Edit {itemTypeLabels[item.item_type]} Item</SheetTitle>
          <SheetDescription>
            Update the details for this {itemTypeLabels[item.item_type].toLowerCase()} item.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 px-4 pb-4">
          {/* Title */}
          <div className="grid gap-2">
            <Label htmlFor="item-title">Title</Label>
            <Input
              id="item-title"
              value={formData.title || ''}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Item title"
            />
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="item-description">Description</Label>
            <Textarea
              id="item-description"
              value={formData.description || ''}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={2}
              placeholder="Brief description..."
            />
          </div>

          {/* VIDEO type-specific fields */}
          {item.item_type === 'VIDEO' && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">Video Content</h4>
              <VideoUpload
                moduleId={item.id}
                currentVideoUrl={formData.video_url || null}
                onVideoUploaded={(url) =>
                  setFormData({ ...formData, video_url: url })
                }
              />
              <div className="grid gap-2">
                <Label htmlFor="soundslice-url">Soundslice Embed URL (optional)</Label>
                <Input
                  id="soundslice-url"
                  value={formData.soundslice_embed_url || ''}
                  onChange={(e) =>
                    setFormData({ ...formData, soundslice_embed_url: e.target.value })
                  }
                  placeholder="https://www.soundslice.com/slices/..."
                />
                <p className="text-xs text-muted-foreground">
                  Add a Soundslice embed for interactive sheet music/tabs
                </p>
              </div>
            </div>
          )}

          {/* QUIZ / EXERCISE type-specific fields */}
          {(item.item_type === 'QUIZ' || item.item_type === 'EXERCISE') && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">
                {item.item_type === 'QUIZ' ? 'Quiz' : 'Exercise'} Content
              </h4>
              <div className="grid gap-2">
                <Label>Question Type</Label>
                <Select
                  value={formData.question_type || 'multiple_choice'}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      question_type: v as QuestionType,
                      options: null,
                      correct_answer: '',
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="multiple_choice">Multiple Choice</SelectItem>
                    <SelectItem value="text_answer">Text Answer</SelectItem>
                    <SelectItem value="true_false">True/False</SelectItem>
                    <SelectItem value="matching_pairs">Matching Pairs</SelectItem>
                    <SelectItem value="fill_in_blank">Fill in the Blank</SelectItem>
                    <SelectItem value="ordering_sequence">Ordering/Sequence</SelectItem>
                    <SelectItem value="audio">Audio Response</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <QuizBuilder
                questionType={(formData.question_type || 'multiple_choice') as QuestionType}
                question={formData.question || ''}
                options={formData.options}
                correctAnswer={formData.correct_answer || ''}
                explanation={formData.explanation || ''}
                onChange={(data) => setFormData({ ...formData, ...data })}
              />
            </div>
          )}

          {/* JAM_SESSION type-specific fields */}
          {item.item_type === 'JAM_SESSION' && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">Jam Session Content</h4>
              <JamSessionEditor
                itemId={item.id}
                audioUrl={formData.audio_url || null}
                bpm={formData.bpm || null}
                keySignature={formData.key_signature || null}
                onChange={(data) => setFormData({ ...formData, ...data })}
              />
            </div>
          )}

          {/* Rich Content (TipTap) */}
          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium">Rich Content</h4>
            <TiptapEditor
              content={formData.rich_content || null}
              onChange={(content) =>
                setFormData({ ...formData, rich_content: content })
              }
            />
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving || !formData.title}>
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Changes'
            )}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
