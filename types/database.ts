export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      blog_posts: {
        Row: {
          author_image_url: string | null
          author_name: string
          category: string
          content: string
          cover_image_url: string | null
          created_at: string | null
          excerpt: string | null
          id: string
          is_published: boolean
          published_at: string | null
          slug: string
          tags: string[] | null
          title: string
          updated_at: string | null
        }
        Insert: {
          author_image_url?: string | null
          author_name?: string
          category?: string
          content: string
          cover_image_url?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug: string
          tags?: string[] | null
          title: string
          updated_at?: string | null
        }
        Update: {
          author_image_url?: string | null
          author_name?: string
          category?: string
          content?: string
          cover_image_url?: string | null
          created_at?: string | null
          excerpt?: string | null
          id?: string
          is_published?: boolean
          published_at?: string | null
          slug?: string
          tags?: string[] | null
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      class_comments: {
        Row: {
          class_id: string
          content: string
          created_at: string | null
          id: string
          is_edited: boolean | null
          parent_comment_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          class_id: string
          content: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          parent_comment_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          class_id?: string
          content?: string
          created_at?: string | null
          id?: string
          is_edited?: boolean | null
          parent_comment_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_comments_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "class_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_item_progress: {
        Row: {
          class_item_id: string
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          last_position_seconds: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          class_item_id: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_position_seconds?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          class_item_id?: string
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_position_seconds?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_item_progress_class_item_id_fkey"
            columns: ["class_item_id"]
            isOneToOne: false
            referencedRelation: "class_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_item_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      class_item_score_sections: {
        Row: {
          active_time_map_id: string | null
          class_item_id: string
          created_at: string | null
          id: string
          label: string | null
          score_document_id: string
          section_index: number
          updated_at: string | null
          video_end_seconds: number | null
          video_start_seconds: number | null
        }
        Insert: {
          active_time_map_id?: string | null
          class_item_id: string
          created_at?: string | null
          id?: string
          label?: string | null
          score_document_id: string
          section_index: number
          updated_at?: string | null
          video_end_seconds?: number | null
          video_start_seconds?: number | null
        }
        Update: {
          active_time_map_id?: string | null
          class_item_id?: string
          created_at?: string | null
          id?: string
          label?: string | null
          score_document_id?: string
          section_index?: number
          updated_at?: string | null
          video_end_seconds?: number | null
          video_start_seconds?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "class_item_score_sections_class_item_id_fkey"
            columns: ["class_item_id"]
            isOneToOne: false
            referencedRelation: "class_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_item_score_sections_score_document_id_fkey"
            columns: ["score_document_id"]
            isOneToOne: false
            referencedRelation: "score_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_item_score_sections_active_time_map_id_fkey"
            columns: ["active_time_map_id"]
            isOneToOne: false
            referencedRelation: "score_time_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      class_items: {
        Row: {
          active_time_map_id: string | null
          audio_url: string | null
          bpm: number | null
          class_id: string
          correct_answer: string | null
          created_at: string | null
          description: string | null
          explanation: string | null
          id: string
          item_type: string
          key_signature: string | null
          options: Json | null
          order_index: number
          question: string | null
          question_type: string | null
          rich_content: Json | null
          score_document_id: string | null
          soundslice_embed_url: string | null
          title: string
          updated_at: string | null
          video_duration_seconds: number | null
          video_url: string | null
        }
        Insert: {
          active_time_map_id?: string | null
          audio_url?: string | null
          bpm?: number | null
          class_id: string
          correct_answer?: string | null
          created_at?: string | null
          description?: string | null
          explanation?: string | null
          id?: string
          item_type: string
          key_signature?: string | null
          options?: Json | null
          order_index?: number
          question?: string | null
          question_type?: string | null
          rich_content?: Json | null
          score_document_id?: string | null
          soundslice_embed_url?: string | null
          title: string
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Update: {
          active_time_map_id?: string | null
          audio_url?: string | null
          bpm?: number | null
          class_id?: string
          correct_answer?: string | null
          created_at?: string | null
          description?: string | null
          explanation?: string | null
          id?: string
          item_type?: string
          key_signature?: string | null
          options?: Json | null
          order_index?: number
          question?: string | null
          question_type?: string | null
          rich_content?: Json | null
          score_document_id?: string | null
          soundslice_embed_url?: string | null
          title?: string
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "class_items_active_time_map_id_fkey"
            columns: ["active_time_map_id"]
            isOneToOne: false
            referencedRelation: "score_time_maps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_items_class_id_fkey"
            columns: ["class_id"]
            isOneToOne: false
            referencedRelation: "classes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "class_items_score_document_id_fkey"
            columns: ["score_document_id"]
            isOneToOne: false
            referencedRelation: "score_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      classes: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_free: boolean | null
          order_index: number
          section_id: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_free?: boolean | null
          order_index?: number
          section_id: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_free?: boolean | null
          order_index?: number
          section_id?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "classes_section_id_fkey"
            columns: ["section_id"]
            isOneToOne: false
            referencedRelation: "course_sections"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string | null
          emoji: string
          id: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string | null
          emoji: string
          id?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string | null
          emoji?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "class_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      course_enrollments: {
        Row: {
          course_id: string
          created_at: string | null
          enrolled_at: string | null
          id: string
          last_accessed_at: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string | null
          enrolled_at?: string | null
          id?: string
          last_accessed_at?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string | null
          enrolled_at?: string | null
          id?: string
          last_accessed_at?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_enrollments_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_enrollments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      course_modules_legacy: {
        Row: {
          correct_answer: string | null
          course_id: string
          created_at: string | null
          description: string | null
          explanation: string | null
          id: string
          is_free: boolean | null
          module_type: string
          options: Json | null
          order_index: number
          question: string | null
          question_type: string | null
          soundslice_embed_url: string | null
          title: string
          updated_at: string | null
          video_duration_seconds: number | null
          video_url: string | null
        }
        Insert: {
          correct_answer?: string | null
          course_id: string
          created_at?: string | null
          description?: string | null
          explanation?: string | null
          id?: string
          is_free?: boolean | null
          module_type: string
          options?: Json | null
          order_index?: number
          question?: string | null
          question_type?: string | null
          soundslice_embed_url?: string | null
          title: string
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Update: {
          correct_answer?: string | null
          course_id?: string
          created_at?: string | null
          description?: string | null
          explanation?: string | null
          id?: string
          is_free?: boolean | null
          module_type?: string
          options?: Json | null
          order_index?: number
          question?: string | null
          question_type?: string | null
          soundslice_embed_url?: string | null
          title?: string
          updated_at?: string | null
          video_duration_seconds?: number | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_modules_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      course_sections: {
        Row: {
          course_id: string
          created_at: string | null
          description: string | null
          id: string
          order_index: number
          title: string
          updated_at: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          order_index?: number
          title: string
          updated_at?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          order_index?: number
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_sections_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          created_at: string | null
          description: string | null
          difficulty: string | null
          id: string
          instrument: string | null
          is_fundamentals: boolean
          is_master_class: boolean
          is_published: boolean | null
          musical_style_id: string | null
          order_index: number | null
          preview_video_url: string | null
          slug: string
          teacher_bio: string | null
          teacher_id: string | null
          teacher_image_url: string | null
          teacher_name: string | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          instrument?: string | null
          is_fundamentals?: boolean
          is_master_class?: boolean
          is_published?: boolean | null
          musical_style_id?: string | null
          order_index?: number | null
          preview_video_url?: string | null
          slug: string
          teacher_bio?: string | null
          teacher_id?: string | null
          teacher_image_url?: string | null
          teacher_name?: string | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          difficulty?: string | null
          id?: string
          instrument?: string | null
          is_fundamentals?: boolean
          is_master_class?: boolean
          is_published?: boolean | null
          musical_style_id?: string | null
          order_index?: number | null
          preview_video_url?: string | null
          slug?: string
          teacher_bio?: string | null
          teacher_id?: string | null
          teacher_image_url?: string | null
          teacher_name?: string | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "courses_musical_style_id_fkey"
            columns: ["musical_style_id"]
            isOneToOne: false
            referencedRelation: "musical_styles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
        ]
      }
      exercise_attempts: {
        Row: {
          created_at: string | null
          exercise_id: string
          id: string
          is_correct: boolean
          user_answer: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          exercise_id: string
          id?: string
          is_correct: boolean
          user_answer: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          exercise_id?: string
          id?: string
          is_correct?: boolean
          user_answer?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "exercise_attempts_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "exercise_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      exercises: {
        Row: {
          correct_answer: string
          created_at: string | null
          description: string | null
          explanation: string | null
          id: string
          lesson_id: string
          options: Json | null
          order_index: number | null
          question: string
          question_type: string
          title: string
          updated_at: string | null
        }
        Insert: {
          correct_answer: string
          created_at?: string | null
          description?: string | null
          explanation?: string | null
          id?: string
          lesson_id: string
          options?: Json | null
          order_index?: number | null
          question: string
          question_type: string
          title: string
          updated_at?: string | null
        }
        Update: {
          correct_answer?: string
          created_at?: string | null
          description?: string | null
          explanation?: string | null
          id?: string
          lesson_id?: string
          options?: Json | null
          order_index?: number | null
          question?: string
          question_type?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "exercises_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback_requests: {
        Row: {
          created_at: string | null
          id: string
          message: string | null
          response_message: string | null
          response_video_url: string | null
          status: string | null
          teacher_id: string
          updated_at: string | null
          user_id: string
          video_url: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          message?: string | null
          response_message?: string | null
          response_video_url?: string | null
          status?: string | null
          teacher_id: string
          updated_at?: string | null
          user_id: string
          video_url: string
        }
        Update: {
          created_at?: string | null
          id?: string
          message?: string | null
          response_message?: string | null
          response_video_url?: string | null
          status?: string | null
          teacher_id?: string
          updated_at?: string | null
          user_id?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "feedback_requests_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "teachers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "feedback_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instrument_styles: {
        Row: {
          instrument_id: string
          style_id: string
        }
        Insert: {
          instrument_id: string
          style_id: string
        }
        Update: {
          instrument_id?: string
          style_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instrument_styles_instrument_id_fkey"
            columns: ["instrument_id"]
            isOneToOne: false
            referencedRelation: "instruments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "instrument_styles_style_id_fkey"
            columns: ["style_id"]
            isOneToOne: false
            referencedRelation: "musical_styles"
            referencedColumns: ["id"]
          },
        ]
      }
      instrument_subscriptions: {
        Row: {
          addon_current_period_end: string | null
          base_current_period_end: string | null
          billing_interval: string
          cancel_at_period_end: boolean
          created_at: string
          id: string
          instrument: string
          pending_interval: string | null
          status: string
          stripe_addon_subscription_id: string | null
          stripe_base_subscription_id: string | null
          stripe_customer_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          addon_current_period_end?: string | null
          base_current_period_end?: string | null
          billing_interval: string
          cancel_at_period_end?: boolean
          created_at?: string
          id?: string
          instrument: string
          pending_interval?: string | null
          status?: string
          stripe_addon_subscription_id?: string | null
          stripe_base_subscription_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          addon_current_period_end?: string | null
          base_current_period_end?: string | null
          billing_interval?: string
          cancel_at_period_end?: boolean
          created_at?: string
          id?: string
          instrument?: string
          pending_interval?: string | null
          status?: string
          stripe_addon_subscription_id?: string | null
          stripe_base_subscription_id?: string | null
          stripe_customer_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "instrument_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      instruments: {
        Row: {
          country_id: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          name: string
          slug: string
        }
        Insert: {
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name: string
          slug: string
        }
        Update: {
          country_id?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "instruments_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      lessons: {
        Row: {
          course_id: string
          created_at: string | null
          description: string | null
          duration_minutes: number | null
          id: string
          is_free: boolean | null
          order_index: number | null
          slug: string
          soundslice_embed_url: string | null
          title: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          course_id: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_free?: boolean | null
          order_index?: number | null
          slug: string
          soundslice_embed_url?: string | null
          title: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          course_id?: string
          created_at?: string | null
          description?: string | null
          duration_minutes?: number | null
          id?: string
          is_free?: boolean | null
          order_index?: number | null
          slug?: string
          soundslice_embed_url?: string | null
          title?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lessons_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      musical_styles: {
        Row: {
          country_id: string
          created_at: string | null
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string | null
        }
        Insert: {
          country_id: string
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string | null
        }
        Update: {
          country_id?: string
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "musical_styles_country_id_fkey"
            columns: ["country_id"]
            isOneToOne: false
            referencedRelation: "countries"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string
          href: string | null
          id: string
          message: string
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          href?: string | null
          id?: string
          message: string
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          href?: string | null
          id?: string
          message?: string
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      play_sense_attempt_events: {
        Row: {
          attempt_id: string
          created_at: string | null
          event_index: number
          grade: string
          id: string
          offset_ms: number | null
          onset_energy: number | null
          timing: string | null
        }
        Insert: {
          attempt_id: string
          created_at?: string | null
          event_index: number
          grade: string
          id?: string
          offset_ms?: number | null
          onset_energy?: number | null
          timing?: string | null
        }
        Update: {
          attempt_id?: string
          created_at?: string | null
          event_index?: number
          grade?: string
          id?: string
          offset_ms?: number | null
          onset_energy?: number | null
          timing?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "play_sense_attempt_events_attempt_id_fkey"
            columns: ["attempt_id"]
            isOneToOne: false
            referencedRelation: "play_sense_attempts"
            referencedColumns: ["id"]
          },
        ]
      }
      play_sense_attempts: {
        Row: {
          accuracy: number
          avg_offset_ms: number | null
          created_at: string | null
          duration_seconds: number | null
          exercise_id: string
          extra_hits: number
          good_count: number
          id: string
          max_combo: number
          max_streak: number
          miss_count: number
          ok_count: number
          perfect_count: number
          score: number
          tempo_drift_ms: number | null
          user_id: string
        }
        Insert: {
          accuracy: number
          avg_offset_ms?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          exercise_id: string
          extra_hits?: number
          good_count?: number
          id?: string
          max_combo?: number
          max_streak?: number
          miss_count?: number
          ok_count?: number
          perfect_count?: number
          score: number
          tempo_drift_ms?: number | null
          user_id: string
        }
        Update: {
          accuracy?: number
          avg_offset_ms?: number | null
          created_at?: string | null
          duration_seconds?: number | null
          exercise_id?: string
          extra_hits?: number
          good_count?: number
          id?: string
          max_combo?: number
          max_streak?: number
          miss_count?: number
          ok_count?: number
          perfect_count?: number
          score?: number
          tempo_drift_ms?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_sense_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      play_sense_songs: {
        Row: {
          created_at: string
          created_by: string | null
          difficulty: string
          id: string
          is_published: boolean
          order_index: number
          score_document_id: string
          title: string
          track_index: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          difficulty?: string
          id?: string
          is_published?: boolean
          order_index?: number
          score_document_id: string
          title: string
          track_index?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          difficulty?: string
          id?: string
          is_published?: boolean
          order_index?: number
          score_document_id?: string
          title?: string
          track_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "play_sense_songs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "play_sense_songs_score_document_id_fkey"
            columns: ["score_document_id"]
            isOneToOne: true
            referencedRelation: "score_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      playsense_studio_events: {
        Row: {
          class_item_id: string | null
          created_at: string | null
          event_type: string
          id: string
          metadata: Json | null
          user_id: string | null
        }
        Insert: {
          class_item_id?: string | null
          created_at?: string | null
          event_type: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Update: {
          class_item_id?: string | null
          created_at?: string | null
          event_type?: string
          id?: string
          metadata?: Json | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "playsense_studio_events_class_item_id_fkey"
            columns: ["class_item_id"]
            isOneToOne: false
            referencedRelation: "class_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "playsense_studio_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pricing: {
        Row: {
          amount_cents: number
          currency: string
          description: string | null
          key: string
          stripe_price_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          amount_cents: number
          currency?: string
          description?: string | null
          key: string
          stripe_price_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          amount_cents?: number
          currency?: string
          description?: string | null
          key?: string
          stripe_price_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pricing_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string | null
          id: string
          is_admin: boolean | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email: string
          full_name?: string | null
          id: string
          is_admin?: boolean | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          is_admin?: boolean | null
          updated_at?: string | null
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          class_item_id: string
          correct_answer: string | null
          created_at: string | null
          explanation: string | null
          id: string
          options: Json | null
          order_index: number
          question: string
          question_type: string
          updated_at: string | null
        }
        Insert: {
          class_item_id: string
          correct_answer?: string | null
          created_at?: string | null
          explanation?: string | null
          id?: string
          options?: Json | null
          order_index?: number
          question: string
          question_type: string
          updated_at?: string | null
        }
        Update: {
          class_item_id?: string
          correct_answer?: string | null
          created_at?: string | null
          explanation?: string | null
          id?: string
          options?: Json | null
          order_index?: number
          question?: string
          question_type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_class_item_id_fkey"
            columns: ["class_item_id"]
            isOneToOne: false
            referencedRelation: "class_items"
            referencedColumns: ["id"]
          },
        ]
      }
      score_clips: {
        Row: {
          class_item_id: string
          created_at: string | null
          end_seconds: number
          id: string
          loop_count: number | null
          name: string
          playback_rate: number | null
          start_seconds: number
          user_id: string
        }
        Insert: {
          class_item_id: string
          created_at?: string | null
          end_seconds: number
          id?: string
          loop_count?: number | null
          name: string
          playback_rate?: number | null
          start_seconds: number
          user_id: string
        }
        Update: {
          class_item_id?: string
          created_at?: string | null
          end_seconds?: number
          id?: string
          loop_count?: number | null
          name?: string
          playback_rate?: number | null
          start_seconds?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_clips_class_item_id_fkey"
            columns: ["class_item_id"]
            isOneToOne: false
            referencedRelation: "class_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_clips_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      score_documents: {
        Row: {
          composer: string | null
          created_at: string | null
          created_by: string | null
          id: string
          parsed_score: Json
          schema_version: number
          source_format: string
          source_storage_path: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          composer?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          parsed_score: Json
          schema_version?: number
          source_format: string
          source_storage_path?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          composer?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          parsed_score?: Json
          schema_version?: number
          source_format?: string
          source_storage_path?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      score_revisions: {
        Row: {
          created_at: string | null
          created_by: string | null
          edit_summary: string | null
          id: string
          parsed_score: Json
          score_document_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          edit_summary?: string | null
          id?: string
          parsed_score: Json
          score_document_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          edit_summary?: string | null
          id?: string
          parsed_score?: Json
          score_document_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "score_revisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_revisions_score_document_id_fkey"
            columns: ["score_document_id"]
            isOneToOne: false
            referencedRelation: "score_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      score_time_maps: {
        Row: {
          class_item_id: string | null
          created_at: string | null
          created_by: string | null
          id: string
          method: string
          params: Json
          score_document_id: string
          updated_at: string | null
        }
        Insert: {
          class_item_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          method: string
          params?: Json
          score_document_id: string
          updated_at?: string | null
        }
        Update: {
          class_item_id?: string | null
          created_at?: string | null
          created_by?: string | null
          id?: string
          method?: string
          params?: Json
          score_document_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "score_time_maps_class_item_id_fkey"
            columns: ["class_item_id"]
            isOneToOne: false
            referencedRelation: "class_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_time_maps_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "score_time_maps_score_document_id_fkey"
            columns: ["score_document_id"]
            isOneToOne: false
            referencedRelation: "score_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      score_time_waypoints: {
        Row: {
          beat_in_measure: number | null
          id: string
          measure_number: number | null
          musical_position_qn: number
          time_map_id: string
          video_time_seconds: number
        }
        Insert: {
          beat_in_measure?: number | null
          id?: string
          measure_number?: number | null
          musical_position_qn: number
          time_map_id: string
          video_time_seconds: number
        }
        Update: {
          beat_in_measure?: number | null
          id?: string
          measure_number?: number | null
          musical_position_qn?: number
          time_map_id?: string
          video_time_seconds?: number
        }
        Relationships: [
          {
            foreignKeyName: "score_time_waypoints_time_map_id_fkey"
            columns: ["time_map_id"]
            isOneToOne: false
            referencedRelation: "score_time_maps"
            referencedColumns: ["id"]
          },
        ]
      }
      score_tracks: {
        Row: {
          channel: number | null
          default_view: string | null
          display_name: string
          id: string
          instrument: string
          score_document_id: string
          string_multiplicity: number | null
          track_index: number
          tuning: Json | null
        }
        Insert: {
          channel?: number | null
          default_view?: string | null
          display_name: string
          id?: string
          instrument: string
          score_document_id: string
          string_multiplicity?: number | null
          track_index: number
          tuning?: Json | null
        }
        Update: {
          channel?: number | null
          default_view?: string | null
          display_name?: string
          id?: string
          instrument?: string
          score_document_id?: string
          string_multiplicity?: number | null
          track_index?: number
          tuning?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "score_tracks_score_document_id_fkey"
            columns: ["score_document_id"]
            isOneToOne: false
            referencedRelation: "score_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_courses: {
        Row: {
          course_id: string
          created_at: string
          id: string
          instrument_subscription_id: string
          user_id: string
        }
        Insert: {
          course_id: string
          created_at?: string
          id?: string
          instrument_subscription_id: string
          user_id: string
        }
        Update: {
          course_id?: string
          created_at?: string
          id?: string
          instrument_subscription_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_courses_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_courses_instrument_subscription_id_fkey"
            columns: ["instrument_subscription_id"]
            isOneToOne: false
            referencedRelation: "instrument_subscriptions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_courses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      teachers: {
        Row: {
          bio: Json | null
          created_at: string | null
          email: string | null
          id: string
          image_url: string | null
          instrument: string
          name: string
          specialties: string[] | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          bio?: Json | null
          created_at?: string | null
          email?: string | null
          id?: string
          image_url?: string | null
          instrument: string
          name: string
          specialties?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          bio?: Json | null
          created_at?: string | null
          email?: string | null
          id?: string
          image_url?: string | null
          instrument?: string
          name?: string
          specialties?: string[] | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "teachers_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_key: string
          id: string
          unlocked_at: string | null
          user_id: string
        }
        Insert: {
          achievement_key: string
          id?: string
          unlocked_at?: string | null
          user_id: string
        }
        Update: {
          achievement_key?: string
          id?: string
          unlocked_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress_legacy: {
        Row: {
          completed: boolean | null
          completed_at: string | null
          created_at: string | null
          id: string
          last_position_seconds: number | null
          lesson_id: string | null
          module_id: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_position_seconds?: number | null
          lesson_id?: string | null
          module_id?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          completed?: boolean | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          last_position_seconds?: number | null
          lesson_id?: string | null
          module_id?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_lesson_id_fkey"
            columns: ["lesson_id"]
            isOneToOne: false
            referencedRelation: "lessons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "course_modules_legacy"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string | null
          email: string
          expertise_level: string | null
          id: string
          instrument_ids: string[]
          style_ids: string[]
        }
        Insert: {
          created_at?: string | null
          email: string
          expertise_level?: string | null
          id?: string
          instrument_ids?: string[]
          style_ids?: string[]
        }
        Update: {
          created_at?: string | null
          email?: string
          expertise_level?: string | null
          id?: string
          instrument_ids?: string[]
          style_ids?: string[]
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_course_access: { Args: { p_course_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
