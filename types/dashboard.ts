// Shared TypeScript interfaces for the dashboard home page.

import type { CalendarCell } from '@/lib/dashboard/practice-calendar'
import type { RecContext, RecCourse, RecReason } from '@/lib/dashboard/recommendations'

/** One enrolled course, with progress measured in classes (lessons). */
export interface HomeCourseSummary {
  id: string
  slug: string
  title: string
  thumbnailUrl: string | null
  styleName: string | null
  teacherName: string | null
  totalClasses: number
  doneClasses: number
  /** 0-based index of the class the learner is on, or null when nothing is started. */
  currentClassIndex: number | null
  currentClassTitle: string | null
  pct: number
  href: string
}

/** One enrolled course on the My Courses page. */
export interface MyCourseRow {
  id: string
  slug: string
  title: string
  thumbnailUrl: string | null
  styleName: string | null
  countryName: string | null
  teacherName: string | null
  instrument: string | null
  totalClasses: number
  doneClasses: number
  totalModules: number
  /** 1-based module (section) holding the current class, or null. */
  currentModuleIndex: number | null
  /** 0-based index of the class the learner is on, or null when nothing is started or all is done. */
  currentClassIndex: number | null
  currentClassTitle: string | null
  pct: number
  status: 'not-started' | 'in-progress' | 'completed'
  href: string
  /** Where the primary button goes: the current lesson, the first lesson, or the course when complete. */
  resumeHref: string
  lastAccessed: string | null
}

export type SegmentState = 'done' | 'current' | 'todo'

/** The continue-learning card ("card B"). */
export interface ContinueCard {
  courseTitle: string
  courseHref: string
  resumeHref: string
  thumbnailUrl: string | null
  styleName: string | null
  classTitle: string
  /** 0-based index of the current class. */
  classIndex: number
  totalClasses: number
  /** Summed video minutes of the class, or null when unknown. */
  classMinutes: number | null
  /** Items completed in the current class, as a percentage. */
  classPct: number
  teacherName: string | null
  teacherImage: string | null
  nextClassTitle: string | null
  segments: SegmentState[]
}

export interface RecommendedCourse extends RecCourse {
  slug: string
  title: string
  thumbnailUrl: string | null
  styleName: string | null
  lessonCount: number | null
  reason: RecReason
  isNew: boolean
  href: string
}

export interface FeedbackSummary {
  kind: 'completed' | 'pending' | 'none'
  teacherName?: string | null
  teacherImage?: string | null
  message?: string | null
  hasVideo?: boolean
  createdAt?: string | null
  status?: string | null
}

export interface MasterClassSummary {
  id: string
  slug: string
  title: string
  teacherName: string | null
  thumbnailUrl: string | null
  styleName: string | null
  href: string
}

export interface MilestoneItem {
  key: string
  title: string
  description: string
  iconName: string
  category: string
  requirement: number
  current: number
  progress: number
}

export interface HomeData {
  firstName: string | null
  streak: number
  bestStreak: number
  weekDone: number
  weekGoal: number
  continueCard: ContinueCard | null
  courses: HomeCourseSummary[]
  recommended: RecommendedCourse[]
  recContext: RecContext
  feedback: FeedbackSummary
  calendar: CalendarCell[]
  masterClass: MasterClassSummary | null
  milestones: MilestoneItem[]
  hasSubscription: boolean
}
