export interface ClassComment {
  id: string
  class_id: string
  user_id: string
  parent_comment_id: string | null
  content: string
  is_edited: boolean | null
  created_at: string | null
  updated_at: string | null
  user?: {
    id: string
    full_name: string | null
    avatar_url: string | null
    is_admin: boolean | null
  }
  reactions?: CommentReaction[]
  replies?: ClassComment[]
}

export interface CommentReaction {
  id: string
  comment_id: string
  user_id: string
  emoji: string
  created_at: string | null
}

export interface ReactionCount {
  emoji: string
  count: number
  hasReacted: boolean
}
