'use client'

import { useState, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Loader2 } from 'lucide-react'
import { VideoUpload } from './video-upload'
import { QuizQuestionsEditor } from './quiz-questions-editor'
import { JamSessionEditor } from './jam-session-editor'
import { TiptapEditor } from './tiptap-editor'
import { PlaysenseStudioScoreAttach } from './playsense-studio-score-attach'
import { ClassItem } from '@/types/modules'
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
        // Questions now live in the quiz_questions table (managed by
        // QuizQuestionsEditor). The class item only carries optional media.
        updates.video_url = formData.video_url || null
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
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent
        className="
          sm:max-w-[min(96vw,1280px)]
          w-[96vw]
          max-h-[92vh]
          p-0
          gap-0
          overflow-hidden
          flex flex-col
        "
      >
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle>Edit {itemTypeLabels[item.item_type]} Item</DialogTitle>
          <DialogDescription>
            Update the details for this {itemTypeLabels[item.item_type].toLowerCase()} item.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Top row — title + description, full width */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="grid gap-2 lg:col-span-1">
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
            <div className="grid gap-2 lg:col-span-2">
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
          </div>

          {/* Two-column layout for the body. Type-specific content on the left
              gets a roomy area for video upload + PlaySense Studio score; rich content
              on the right gives the TipTap editor breathing space. */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-border">
            {/* Left column — type-specific content */}
            <div className="space-y-6">
              {item.item_type === 'VIDEO' && (
                <div className="space-y-5">
                  <h4 className="font-medium">Video Content</h4>
                  <VideoUpload
                    moduleId={item.id}
                    currentVideoUrl={formData.video_url || null}
                    onVideoUploaded={(url) =>
                      setFormData({ ...formData, video_url: url })
                    }
                  />

                  <PlaysenseStudioScoreAttach
                    classItemId={item.id}
                    itemType={item.item_type}
                    currentScoreDocumentId={
                      (item as ClassItem & { score_document_id?: string | null })
                        .score_document_id ?? null
                    }
                  />

                  <details className="group">
                    <summary className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition">
                      Legacy Soundslice URL
                    </summary>
                    <div className="grid gap-2 mt-3">
                      <Label htmlFor="soundslice-url">Soundslice Embed URL</Label>
                      <Input
                        id="soundslice-url"
                        value={formData.soundslice_embed_url || ''}
                        onChange={(e) =>
                          setFormData({ ...formData, soundslice_embed_url: e.target.value })
                        }
                        placeholder="https://www.soundslice.com/slices/..."
                      />
                      <p className="text-xs text-muted-foreground">
                        Used as a fallback when no PlaySense Studio score is attached. New
                        content should use the PlaySense Studio Score importer above.
                      </p>
                    </div>
                  </details>
                </div>
              )}

              {item.item_type === 'QUIZ' && (
                <div className="space-y-6">
                  {/* Optional intro video / notation for the quiz */}
                  <details className="group" open={!!formData.video_url}>
                    <summary className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition">
                      Intro Video & Notation (optional)
                    </summary>
                    <div className="space-y-5 mt-3">
                      <VideoUpload
                        moduleId={item.id}
                        currentVideoUrl={formData.video_url || null}
                        onVideoUploaded={(url) =>
                          setFormData({ ...formData, video_url: url })
                        }
                      />
                      <PlaysenseStudioScoreAttach
                        classItemId={item.id}
                        currentScoreDocumentId={
                          (item as ClassItem & { score_document_id?: string | null })
                            .score_document_id ?? null
                        }
                      />
                    </div>
                  </details>

                  <QuizQuestionsEditor classItemId={item.id} kind="Quiz" />
                </div>
              )}

              {item.item_type === 'EXERCISE' && (
                <div className="space-y-6">
                  {/* Exercise media + score: video synced to the PlaySense notation
                      staff; the rhythm-highway test view is auto-derived from the score. */}
                  <div className="space-y-5">
                    <h4 className="font-medium">Exercise Video & Score</h4>
                    <VideoUpload
                      moduleId={item.id}
                      currentVideoUrl={formData.video_url || null}
                      onVideoUploaded={(url) =>
                        setFormData({ ...formData, video_url: url })
                      }
                    />
                    <PlaysenseStudioScoreAttach
                      classItemId={item.id}
                      currentScoreDocumentId={
                        (item as ClassItem & { score_document_id?: string | null })
                          .score_document_id ?? null
                      }
                    />
                  </div>

                  {/* Optional comprehension questions for the exercise */}
                  <details className="group">
                    <summary className="text-xs uppercase tracking-wider text-muted-foreground cursor-pointer hover:text-foreground transition">
                      Questions (optional)
                    </summary>
                    <div className="mt-3">
                      <QuizQuestionsEditor classItemId={item.id} kind="Exercise" />
                    </div>
                  </details>
                </div>
              )}

              {item.item_type === 'JAM_SESSION' && (
                <div className="space-y-4">
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
            </div>

            {/* Right column — rich content editor */}
            <div className="space-y-3 lg:border-l lg:border-border lg:pl-6">
              <h4 className="font-medium">Rich Content</h4>
              <p className="text-xs text-muted-foreground">
                Notes, instructions, and other supporting material rendered below the player on the lesson page.
              </p>
              <TiptapEditor
                content={formData.rich_content || null}
                onChange={(content) =>
                  setFormData({ ...formData, rich_content: content })
                }
              />
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/20">
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
