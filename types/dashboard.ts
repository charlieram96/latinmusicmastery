// Shared TypeScript interfaces for dashboard section components

export interface DashboardProfile {
  full_name: string | null
}

export interface DashboardCourse {
  id: string
  title: string
  slug: string
  thumbnail_url: string | null
  description?: string | null
  difficulty?: string | null
  created_at?: string
  musical_style?: { name: string } | null
  teacher?: { name: string } | null
}

export interface CourseProgress {
  course: DashboardCourse
  total: number
  completed: number
  teacherName: string | null
  pct: number
  nextLabel: string
}

export interface ContinueLearningData {
  courseId: string
  courseSlug: string
  courseTitle: string
  courseThumbnail: string | null
  classId: string | null
  teacherName: string | null
  nextLessonTitle: string | null
  pct: number
}

export interface WeekDay {
  label: string
  practiced: boolean
  today: boolean
}

export interface WeekStripProps {
  days: WeekDay[]
  streak: number
}

export interface WelcomeSummaryProps {
  name: string | null
  streak: number
  itemsCompletedThisWeek: number
}

export interface ContinueLearningHeroProps {
  continueData: ContinueLearningData | null
}

export interface MyCoursesProps {
  courses: CourseProgress[]
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

export interface LearningMilestonesProps {
  milestones: MilestoneItem[]
}

export interface FeaturedTeacher {
  id: string
  name: string
  bio: unknown
  image_url: string | null
  instrument?: string | null
}

export interface RecommendedFeaturedProps {
  recommendedCourses: DashboardCourse[]
  newCourseIds: Set<string>
  featuredTeacher: FeaturedTeacher | null
  allCourses: DashboardCourse[]
}

export interface RecentActivityItem {
  id: string
  type: 'lesson_completed' | 'achievement_earned'
  title: string
  subtitle: string | null
  timestamp: string
  iconName: string
}

export interface RecentActivityProps {
  activities: RecentActivityItem[]
}

export interface SubscriptionCtaProps {
  hasSubscription: boolean
  variant?: 'default' | 'sidebar'
}
