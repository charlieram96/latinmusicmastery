'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function addComment(classId: string, content: string, parentId?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('class_comments')
    .insert({
      class_id: classId,
      user_id: user.id,
      parent_comment_id: parentId || null,
      content,
    })
    .select(`
      *,
      user:profiles!class_comments_user_id_fkey (
        id, full_name, avatar_url, is_admin
      )
    `)
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/course`)
  return { data }
}

export async function updateComment(commentId: string, content: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  const { data, error } = await supabase
    .from('class_comments')
    .update({ content, is_edited: true })
    .eq('id', commentId)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/course`)
  return { data }
}

export async function deleteComment(commentId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // RLS handles the own-user / admin check
  const { error } = await supabase
    .from('class_comments')
    .delete()
    .eq('id', commentId)

  if (error) return { error: error.message }

  revalidatePath(`/dashboard/course`)
  return { success: true }
}

export async function toggleReaction(commentId: string, emoji: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // Check if reaction already exists
  const { data: existing } = await supabase
    .from('comment_reactions')
    .select('id')
    .eq('comment_id', commentId)
    .eq('user_id', user.id)
    .eq('emoji', emoji)
    .single()

  if (existing) {
    // Remove reaction
    const { error } = await supabase
      .from('comment_reactions')
      .delete()
      .eq('id', existing.id)

    if (error) return { error: error.message }
    return { action: 'removed' as const }
  } else {
    // Add reaction
    const { error } = await supabase
      .from('comment_reactions')
      .insert({
        comment_id: commentId,
        user_id: user.id,
        emoji,
      })

    if (error) return { error: error.message }
    return { action: 'added' as const }
  }
}

export async function getComments(classId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('class_comments')
    .select(`
      *,
      user:profiles!class_comments_user_id_fkey (
        id, full_name, avatar_url, is_admin
      ),
      reactions:comment_reactions (*)
    `)
    .eq('class_id', classId)
    .order('created_at', { ascending: true })

  if (error) return { error: error.message }

  // Build thread tree: top-level comments with nested replies
  const commentMap = new Map<string, typeof data[0] & { replies: typeof data }>()
  const topLevel: (typeof data[0] & { replies: typeof data })[] = []

  // First pass: create all entries with replies array
  for (const comment of data || []) {
    commentMap.set(comment.id, { ...comment, replies: [] })
  }

  // Second pass: build tree
  for (const comment of data || []) {
    const node = commentMap.get(comment.id)!
    if (comment.parent_comment_id) {
      const parent = commentMap.get(comment.parent_comment_id)
      if (parent) {
        parent.replies.push(node)
      } else {
        topLevel.push(node)
      }
    } else {
      topLevel.push(node)
    }
  }

  return { data: topLevel }
}
