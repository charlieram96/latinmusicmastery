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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Loader2 } from 'lucide-react'
import { VideoUpload } from './video-upload'
import { QuizBuilder } from './quiz-builder'
import { CourseModule, ModuleType, QuestionType } from '@/types/modules'
import { createClient } from '@/lib/supabase/client'

interface ModuleEditorDialogProps {
  courseId: string
  module: Partial<CourseModule> | null
  isOpen: boolean
  onClose: () => void
  onSave: (module: CourseModule) => void
}

export function ModuleEditorDialog({
  courseId,
  module,
  isOpen,
  onClose,
  onSave,
}: ModuleEditorDialogProps) {
  const isNew = !module?.id
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<Partial<CourseModule>>({
    module_type: 'VIDEO',
    title: '',
    description: '',
    is_free: false,
    question: '',
    question_type: 'multiple_choice',
    options: null,
    correct_answer: '',
    explanation: '',
    video_url: '',
    soundslice_embed_url: '',
  })

  // Reset form when module changes
  useEffect(() => {
    if (module) {
      setFormData({
        module_type: module.module_type || 'VIDEO',
        title: module.title || '',
        description: module.description || '',
        is_free: module.is_free || false,
        question: module.question || '',
        question_type: module.question_type || 'multiple_choice',
        options: module.options || null,
        correct_answer: module.correct_answer || '',
        explanation: module.explanation || '',
        video_url: module.video_url || '',
        soundslice_embed_url: module.soundslice_embed_url || '',
      })
    } else {
      setFormData({
        module_type: 'VIDEO',
        title: '',
        description: '',
        is_free: false,
        question: '',
        question_type: 'multiple_choice',
        options: null,
        correct_answer: '',
        explanation: '',
        video_url: '',
        soundslice_embed_url: '',
      })
    }
  }, [module, isOpen])

  const handleSave = async () => {
    if (!formData.title) return

    setSaving(true)
    const supabase = createClient()

    try {
      if (isNew) {
        // Get max order_index for this course
        const { data: existing } = await supabase
          .from('course_modules_legacy')
          .select('order_index')
          .eq('course_id', courseId)
          .order('order_index', { ascending: false })
          .limit(1)

        const maxOrder = existing?.[0]?.order_index ?? -1

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase
          .from('course_modules_legacy') as any)
          .insert({
            course_id: courseId,
            module_type: formData.module_type,
            title: formData.title,
            description: formData.description || null,
            is_free: formData.is_free,
            order_index: maxOrder + 1,
            // VIDEO fields
            video_url: formData.module_type === 'VIDEO' ? formData.video_url || null : null,
            soundslice_embed_url: formData.module_type === 'VIDEO' ? formData.soundslice_embed_url || null : null,
            // QUIZ/EXERCISE fields
            question: formData.module_type !== 'VIDEO' ? formData.question || null : null,
            question_type: formData.module_type !== 'VIDEO' ? formData.question_type : null,
            options: formData.module_type !== 'VIDEO' ? formData.options : null,
            correct_answer: formData.module_type !== 'VIDEO' ? formData.correct_answer || null : null,
            explanation: formData.module_type !== 'VIDEO' ? formData.explanation || null : null,
          })
          .select()
          .single()

        if (error) throw error
        onSave(data as unknown as CourseModule)
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (supabase
          .from('course_modules_legacy') as any)
          .update({
            title: formData.title,
            description: formData.description || null,
            is_free: formData.is_free,
            // VIDEO fields
            video_url: formData.module_type === 'VIDEO' ? formData.video_url || null : null,
            soundslice_embed_url: formData.module_type === 'VIDEO' ? formData.soundslice_embed_url || null : null,
            // QUIZ/EXERCISE fields
            question: formData.module_type !== 'VIDEO' ? formData.question || null : null,
            question_type: formData.module_type !== 'VIDEO' ? formData.question_type : null,
            options: formData.module_type !== 'VIDEO' ? formData.options : null,
            correct_answer: formData.module_type !== 'VIDEO' ? formData.correct_answer || null : null,
            explanation: formData.module_type !== 'VIDEO' ? formData.explanation || null : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', module!.id)
          .select()
          .single()

        if (error) throw error
        onSave(data as unknown as CourseModule)
      }
      onClose()
    } catch (err) {
      console.error('Error saving module:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Add Module' : 'Edit Module'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Module Type Selector (only for new modules) */}
          {isNew && (
            <div className="grid gap-2">
              <Label>Module Type</Label>
              <Select
                value={formData.module_type}
                onValueChange={(v) =>
                  setFormData({ ...formData, module_type: v as ModuleType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VIDEO">Video Lesson</SelectItem>
                  <SelectItem value="QUIZ">Quiz</SelectItem>
                  <SelectItem value="EXERCISE">Exercise</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Common Fields */}
          <div className="grid gap-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Module title"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description || ''}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              rows={3}
              placeholder="Brief description of this module..."
            />
          </div>

          <div className="flex items-center gap-3">
            <Switch
              checked={formData.is_free}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_free: checked })
              }
            />
            <Label className="font-normal">Free Preview (available without subscription)</Label>
          </div>

          {/* Type-Specific Fields */}
          {formData.module_type === 'VIDEO' && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">Video Content</h4>
              <VideoUpload
                moduleId={module?.id || 'new'}
                currentVideoUrl={formData.video_url || null}
                onVideoUploaded={(url) =>
                  setFormData({ ...formData, video_url: url })
                }
              />
              <div className="grid gap-2">
                <Label htmlFor="soundslice">Soundslice Embed URL (optional)</Label>
                <Input
                  id="soundslice"
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

          {(formData.module_type === 'QUIZ' ||
            formData.module_type === 'EXERCISE') && (
            <div className="space-y-4 pt-4 border-t">
              <h4 className="font-medium">
                {formData.module_type === 'QUIZ' ? 'Quiz' : 'Exercise'} Content
              </h4>
              <div className="grid gap-2">
                <Label>Question Type</Label>
                <Select
                  value={formData.question_type || 'multiple_choice'}
                  onValueChange={(v) =>
                    setFormData({
                      ...formData,
                      question_type: v as QuestionType,
                      options: null, // Reset options when type changes
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
                questionType={formData.question_type || 'multiple_choice'}
                question={formData.question || ''}
                options={formData.options}
                correctAnswer={formData.correct_answer || ''}
                explanation={formData.explanation || ''}
                onChange={(data) => setFormData({ ...formData, ...data })}
              />
            </div>
          )}
        </div>

        <DialogFooter>
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
              'Save Module'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
