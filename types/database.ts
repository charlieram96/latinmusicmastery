export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          is_admin: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string
          full_name?: string | null
          is_admin?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      countries: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          image_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          image_url?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      musical_styles: {
        Row: {
          id: string
          country_id: string
          name: string
          slug: string
          description: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          country_id: string
          name: string
          slug: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          country_id?: string
          name?: string
          slug?: string
          description?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      courses: {
        Row: {
          id: string
          musical_style_id: string
          title: string
          slug: string
          description: string | null
          preview_video_url: string | null
          thumbnail_url: string | null
          teacher_name: string
          teacher_bio: string | null
          teacher_image_url: string | null
          is_published: boolean
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          musical_style_id: string
          title: string
          slug: string
          description?: string | null
          preview_video_url?: string | null
          thumbnail_url?: string | null
          teacher_name: string
          teacher_bio?: string | null
          teacher_image_url?: string | null
          is_published?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          musical_style_id?: string
          title?: string
          slug?: string
          description?: string | null
          preview_video_url?: string | null
          thumbnail_url?: string | null
          teacher_name?: string
          teacher_bio?: string | null
          teacher_image_url?: string | null
          is_published?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      lessons: {
        Row: {
          id: string
          course_id: string
          title: string
          slug: string
          description: string | null
          soundslice_embed_url: string | null
          video_url: string | null
          duration_minutes: number | null
          is_free: boolean
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          course_id: string
          title: string
          slug: string
          description?: string | null
          soundslice_embed_url?: string | null
          video_url?: string | null
          duration_minutes?: number | null
          is_free?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          course_id?: string
          title?: string
          slug?: string
          description?: string | null
          soundslice_embed_url?: string | null
          video_url?: string | null
          duration_minutes?: number | null
          is_free?: boolean
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      exercises: {
        Row: {
          id: string
          lesson_id: string
          title: string
          description: string | null
          question: string
          question_type: 'multiple_choice' | 'text' | 'audio'
          options: Json | null
          correct_answer: string
          explanation: string | null
          order_index: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          lesson_id: string
          title: string
          description?: string | null
          question: string
          question_type: 'multiple_choice' | 'text' | 'audio'
          options?: Json | null
          correct_answer: string
          explanation?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          lesson_id?: string
          title?: string
          description?: string | null
          question?: string
          question_type?: 'multiple_choice' | 'text' | 'audio'
          options?: Json | null
          correct_answer?: string
          explanation?: string | null
          order_index?: number
          created_at?: string
          updated_at?: string
        }
      }
      subscriptions: {
        Row: {
          id: string
          user_id: string
          stripe_customer_id: string
          stripe_subscription_id: string
          status: 'active' | 'canceled' | 'past_due' | 'incomplete'
          current_period_start: string
          current_period_end: string
          cancel_at_period_end: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          stripe_customer_id: string
          stripe_subscription_id: string
          status: 'active' | 'canceled' | 'past_due' | 'incomplete'
          current_period_start: string
          current_period_end: string
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          status?: 'active' | 'canceled' | 'past_due' | 'incomplete'
          current_period_start?: string
          current_period_end?: string
          cancel_at_period_end?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      user_progress: {
        Row: {
          id: string
          user_id: string
          lesson_id: string
          completed: boolean
          completed_at: string | null
          last_position_seconds: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          lesson_id: string
          completed?: boolean
          completed_at?: string | null
          last_position_seconds?: number | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          lesson_id?: string
          completed?: boolean
          completed_at?: string | null
          last_position_seconds?: number | null
          created_at?: string
          updated_at?: string
        }
      }
      exercise_attempts: {
        Row: {
          id: string
          user_id: string
          exercise_id: string
          user_answer: string
          is_correct: boolean
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          exercise_id: string
          user_answer: string
          is_correct: boolean
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          exercise_id?: string
          user_answer?: string
          is_correct?: boolean
          created_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}
