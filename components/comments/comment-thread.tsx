'use client'

import { useState } from 'react'
import { MessageSquare, Trash2 } from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { timeAgo } from '@/lib/time-ago'
import { CommentForm } from './comment-form'
import { ReactionBar } from './reaction-bar'
import type { ClassComment, ReactionCount } from '@/types/comments'

interface CommentThreadProps {
  comment: ClassComment
  userId: string
  depth?: number
  onReply: (parentId: string, content: string) => Promise<void>
  onDelete: (commentId: string) => Promise<void>
  onReact: (commentId: string, emoji: string) => Promise<void>
}

export function CommentThread({
  comment,
  userId,
  depth = 0,
  onReply,
  onDelete,
  onReact,
}: CommentThreadProps) {
  const [showReplyForm, setShowReplyForm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  const isOwner = comment.user_id === userId
  const initials = comment.user?.full_name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?'

  // Group reactions by emoji
  const reactionCounts: ReactionCount[] = []
  const emojiMap = new Map<string, { count: number; hasReacted: boolean }>()
  for (const r of comment.reactions || []) {
    const existing = emojiMap.get(r.emoji)
    if (existing) {
      existing.count++
      if (r.user_id === userId) existing.hasReacted = true
    } else {
      emojiMap.set(r.emoji, { count: 1, hasReacted: r.user_id === userId })
    }
  }
  emojiMap.forEach((val, emoji) => {
    reactionCounts.push({ emoji, ...val })
  })

  const handleDelete = async () => {
    if (!confirm('Delete this comment?')) return
    setIsDeleting(true)
    await onDelete(comment.id)
    setIsDeleting(false)
  }

  return (
    <div className={depth > 0 ? 'ml-10 border-l-2 border-border pl-4' : ''}>
      <div className="flex gap-3 py-3">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={comment.user?.avatar_url || undefined} />
          <AvatarFallback className="text-xs">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium">
              {comment.user?.full_name || 'Anonymous'}
            </span>
            {comment.user?.is_admin && (
              <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20">
                Instructor
              </Badge>
            )}
            <span className="text-xs text-muted-foreground">
              {timeAgo(comment.created_at)}
            </span>
            {comment.is_edited && (
              <span className="text-xs text-muted-foreground">(edited)</span>
            )}
          </div>
          <p className="text-sm whitespace-pre-wrap">{comment.content}</p>

          {/* Reactions */}
          {reactionCounts.length > 0 && (
            <div className="mt-2">
              <ReactionBar
                reactions={reactionCounts}
                onReact={(emoji) => onReact(comment.id, emoji)}
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-2">
            {depth < 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => setShowReplyForm(!showReplyForm)}
              >
                <MessageSquare className="h-3 w-3 mr-1" />
                Reply
              </Button>
            )}
            <ReactionBar
              reactions={reactionCounts.length === 0 ? [] : []}
              onReact={(emoji) => onReact(comment.id, emoji)}
            />
            {reactionCounts.length === 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground"
                onClick={() => onReact(comment.id, '👍')}
              >
                👍
              </Button>
            )}
            {isOwner && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Delete
              </Button>
            )}
          </div>

          {/* Reply Form */}
          {showReplyForm && (
            <div className="mt-3">
              <CommentForm
                onSubmit={async (content) => {
                  await onReply(comment.id, content)
                  setShowReplyForm(false)
                }}
                placeholder="Write a reply..."
                autoFocus
                onCancel={() => setShowReplyForm(false)}
              />
            </div>
          )}
        </div>
      </div>

      {/* Nested Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div>
          {comment.replies.map((reply) => (
            <CommentThread
              key={reply.id}
              comment={reply}
              userId={userId}
              depth={depth + 1}
              onReply={onReply}
              onDelete={onDelete}
              onReact={onReact}
            />
          ))}
        </div>
      )}
    </div>
  )
}
