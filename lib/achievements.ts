// Shared achievements definitions used by both the achievements page and dashboard milestones

export interface Achievement {
  key: string
  title: string
  description: string
  iconName: string
  category: string
  requirement: number
  color: string
}

export const ACHIEVEMENTS: Record<string, Achievement> = {
  // Learning Milestones
  first_lesson: {
    key: 'first_lesson',
    title: 'First Steps',
    description: 'Complete your first lesson',
    iconName: 'BookOpen',
    category: 'learning',
    requirement: 1,
    color: 'from-amber-500/80 to-amber-600/80',
  },
  lessons_10: {
    key: 'lessons_10',
    title: 'Dedicated Learner',
    description: 'Complete 10 lessons',
    iconName: 'Target',
    category: 'learning',
    requirement: 10,
    color: 'from-amber-500/80 to-amber-600/80',
  },
  lessons_25: {
    key: 'lessons_25',
    title: 'Rising Star',
    description: 'Complete 25 lessons',
    iconName: 'Star',
    category: 'learning',
    requirement: 25,
    color: 'from-amber-500/80 to-amber-600/80',
  },
  lessons_50: {
    key: 'lessons_50',
    title: 'Master Student',
    description: 'Complete 50 lessons',
    iconName: 'Trophy',
    category: 'learning',
    requirement: 50,
    color: 'from-amber-500/80 to-amber-600/80',
  },
  lessons_100: {
    key: 'lessons_100',
    title: 'Century Club',
    description: 'Complete 100 lessons',
    iconName: 'Crown',
    category: 'learning',
    requirement: 100,
    color: 'from-amber-500/80 to-amber-600/80',
  },

  // Consistency Streaks
  streak_3: {
    key: 'streak_3',
    title: 'Getting Started',
    description: 'Maintain a 3-day learning streak',
    iconName: 'Flame',
    category: 'consistency',
    requirement: 3,
    color: 'from-amber-500/80 to-amber-600/80',
  },
  streak_7: {
    key: 'streak_7',
    title: 'Week Warrior',
    description: 'Maintain a 7-day learning streak',
    iconName: 'Flame',
    category: 'consistency',
    requirement: 7,
    color: 'from-amber-500/80 to-amber-600/80',
  },
  streak_30: {
    key: 'streak_30',
    title: 'Monthly Master',
    description: 'Maintain a 30-day learning streak',
    iconName: 'Zap',
    category: 'consistency',
    requirement: 30,
    color: 'from-amber-500/80 to-amber-600/80',
  },

  // Course Completion
  course_first: {
    key: 'course_first',
    title: 'Course Conqueror',
    description: 'Complete your first full course',
    iconName: 'Award',
    category: 'completion',
    requirement: 1,
    color: 'from-emerald-500/80 to-emerald-600/80',
  },
  course_3: {
    key: 'course_3',
    title: 'Triple Threat',
    description: 'Complete 3 courses',
    iconName: 'Sparkles',
    category: 'completion',
    requirement: 3,
    color: 'from-emerald-500/80 to-emerald-600/80',
  },
  course_5: {
    key: 'course_5',
    title: 'Course Champion',
    description: 'Complete 5 courses',
    iconName: 'GraduationCap',
    category: 'completion',
    requirement: 5,
    color: 'from-emerald-500/80 to-emerald-600/80',
  },

  // Exploration
  styles_3: {
    key: 'styles_3',
    title: 'Style Explorer',
    description: 'Try lessons from 3 different styles',
    iconName: 'Compass',
    category: 'exploration',
    requirement: 3,
    color: 'from-blue-400/80 to-blue-500/80',
  },
  styles_5: {
    key: 'styles_5',
    title: 'Genre Guru',
    description: 'Try lessons from 5 different styles',
    iconName: 'Music',
    category: 'exploration',
    requirement: 5,
    color: 'from-blue-400/80 to-blue-500/80',
  },
  teachers_3: {
    key: 'teachers_3',
    title: 'Open Minded',
    description: 'Learn from 3 different teachers',
    iconName: 'Users',
    category: 'exploration',
    requirement: 3,
    color: 'from-blue-400/80 to-blue-500/80',
  },

  // Engagement
  feedback_first: {
    key: 'feedback_first',
    title: 'Feedback Seeker',
    description: 'Request your first teacher feedback',
    iconName: 'Video',
    category: 'engagement',
    requirement: 1,
    color: 'from-amber-500/80 to-amber-600/80',
  },
  community_joined: {
    key: 'community_joined',
    title: 'Community Member',
    description: 'Join the Discord community',
    iconName: 'Heart',
    category: 'engagement',
    requirement: 1,
    color: 'from-amber-500/80 to-amber-600/80',
  },
}

export const CATEGORY_ORDER = ['learning', 'consistency', 'completion', 'exploration', 'engagement']

export const CATEGORY_LABELS: Record<string, string> = {
  learning: 'Learning Milestones',
  consistency: 'Consistency Streaks',
  completion: 'Course Completion',
  exploration: 'Style Explorer',
  engagement: 'Community Engagement',
}

// Map icon names to Lucide icon imports for use in components
// Components should import icons and pass them via this map
export const ICON_NAME_MAP: Record<string, string> = {
  BookOpen: 'BookOpen',
  Target: 'Target',
  Star: 'Star',
  Trophy: 'Trophy',
  Crown: 'Crown',
  Flame: 'Flame',
  Zap: 'Zap',
  Award: 'Award',
  Sparkles: 'Sparkles',
  GraduationCap: 'GraduationCap',
  Compass: 'Compass',
  Music: 'Music',
  Users: 'Users',
  Video: 'Video',
  Heart: 'Heart',
}
