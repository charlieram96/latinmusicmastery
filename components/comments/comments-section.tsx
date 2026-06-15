'use client'

import { useState } from 'react'
import { MessageSquare } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CommentForm } from './comment-form'
import { CommentThread } from './comment-thread'
import { addComment, deleteComment, toggleReaction } from '@/app/actions/comments'
import type { ClassComment } from '@/types/comments'

interface CommentsSectionProps {
  classId: string
  initialComments: ClassComment[]
  userId: string
}

export function CommentsSection({
  classId,
  initialComments,
  userId,
}: CommentsSectionProps) {
  const [comments, setComments] = useState<ClassComment[]>(initialComments)
  const [isLoading, setIsLoading] = useState(false)

  const handleAddComment = async (content: string) => {
    setIsLoading(true)
    try {
      const result = await addComment(classId, content)
      if (result.data) {
        setComments((prev) => [...prev, { ...result.data, replies: [] } as ClassComment])
      }
    } catch (error) {
      console.error('Error adding comment:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleReply = async (parentId: string, content: string) => {
    const result = await addComment(classId, content, parentId)
    if (result.data) {
      setComments((prev) => {
        const addReply = (items: ClassComment[]): ClassComment[] =>
          items.map((comment) => {
            if (comment.id === parentId) {
              return {
                ...comment,
                replies: [...(comment.replies || []), { ...result.data, replies: [] } as ClassComment],
              }
            }
            if (comment.replies?.length) {
              return { ...comment, replies: addReply(comment.replies) }
            }
            return comment
          })
        return addReply(prev)
      })
    }
  }

  const handleDelete = async (commentId: string) => {
    const result = await deleteComment(commentId)
    if (result.success) {
      setComments((prev) => {
        const removeComment = (items: ClassComment[]): ClassComment[] =>
          items
            .filter((c) => c.id !== commentId)
            .map((c) => ({
              ...c,
              replies: c.replies ? removeComment(c.replies) : [],
            }))
        return removeComment(prev)
      })
    }
  }

  const handleReact = async (commentId: string, emoji: string) => {
    const result = await toggleReaction(commentId, emoji)
    if (result.error) return

    setComments((prev) => {
      const updateReactions = (items: ClassComment[]): ClassComment[] =>
        items.map((comment) => {
          if (comment.id === commentId) {
            const reactions = comment.reactions || []
            if (result.action === 'added') {
              return {
                ...comment,
                reactions: [
                  ...reactions,
                  { id: crypto.randomUUID(), comment_id: commentId, user_id: userId, emoji, created_at: new Date().toISOString() },
                ],
              }
            } else {
              return {
                ...comment,
                reactions: reactions.filter(
                  (r) => !(r.user_id === userId && r.emoji === emoji)
                ),
              }
            }
          }
          if (comment.replies?.length) {
            return { ...comment, replies: updateReactions(comment.replies) }
          }
          return comment
        })
      return updateReactions(prev)
    })
  }

  return (
    <Card className="rounded-2xl border-border bg-raised shadow-warm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5 font-heading text-lg font-bold tracking-tight">
          <MessageSquare className="h-5 w-5 text-muted-foreground" />
          Discussion
          {comments.length > 0 && (
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full border border-border bg-background px-2 text-xs font-semibold tabular-nums text-muted-foreground">
              {comments.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <CommentForm onSubmit={handleAddComment} isLoading={isLoading} />

        {comments.length > 0 ? (
          <div className="divide-y">
            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                userId={userId}
                onReply={handleReply}
                onDelete={handleDelete}
                onReact={handleReact}
              />
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-6">
            No comments yet. Be the first to start the discussion!
          </p>
        )}
      </CardContent>
    </Card>
  )
}
