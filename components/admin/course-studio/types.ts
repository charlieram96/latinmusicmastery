import type { CourseSection, ClassRecord, ClassItem } from '@/types/modules'

export interface ClassWithItems extends ClassRecord {
  items: ClassItem[]
}

export interface SectionWithClasses extends CourseSection {
  classes: ClassWithItems[]
}

export interface CourseStudioCourse {
  id: string
  title: string
  title_es: string | null
  slug: string
  description: string | null
  description_es: string | null
  musical_style_id: string | null
  teacher_id: string | null
  is_published: boolean
  thumbnail_url: string | null
  instrument: string | null
  is_fundamentals: boolean
  difficulty: string | null
  is_master_class: boolean
}

export interface MusicalStyleOption {
  id: string
  name: string
  country: { name: string }
}

export interface TeacherOption {
  id: string
  name: string
  instrument: string
}

/** What the center (main) area renders. */
export type CenterSelection =
  | { type: 'module'; id: string }
  | { type: 'class'; id: string }
  | null

/** What the inspector edits; none keeps it closed. */
export type DrawerSelection =
  | { type: 'none' }
  | { type: 'course' }
  | { type: 'module'; id: string }
  | { type: 'class'; id: string }
  | { type: 'item'; id: string }
