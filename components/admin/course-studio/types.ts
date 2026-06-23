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

export type DrawerState =
  | { mode: 'item'; itemId: string }
  | { mode: 'settings' }
  | null
