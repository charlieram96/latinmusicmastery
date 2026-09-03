'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Send } from 'lucide-react'
import { useTranslation } from '@/components/language-provider'

interface CommentFormProps {
  onSubmit: (content: string) => Promise<void>
  isLoading?: boolean
  placeholder?: string
  autoFocus?: boolean
  onCancel?: () => void
}

export function CommentForm({
  onSubmit,
  isLoading = false,
  placeholder,
  autoFocus = false,
  onCancel,
}: CommentFormProps) {
  const { t } = useTranslation()
  const [content, setContent] = useState('')

  const handleSubmit = async () => {
    if (!content.trim()) return
    await onSubmit(content.trim())
    setContent('')
  }

  return (
    <div className="space-y-3">
      <Textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={placeholder ?? t('dashboard.classViewer.discussion.placeholder')}
        autoFocus={autoFocus}
        rows={3}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault()
            handleSubmit()
          }
        }}
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {t('dashboard.classViewer.discussion.submitHint')}
        </p>
        <div className="flex items-center gap-2">
          {onCancel && (
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={isLoading}>
              {t('common.cancel')}
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isLoading || !content.trim()}
          >
            <Send className="h-4 w-4 mr-1" />
            {isLoading ? t('dashboard.classViewer.discussion.posting') : t('dashboard.classViewer.discussion.post')}
          </Button>
        </div>
      </div>
    </div>
  )
}
