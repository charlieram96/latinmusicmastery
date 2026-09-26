// Numbers for the end-of-lesson celebration: the streak, the weekly goal and
// the next achievements, before and after the completions made in this visit.
// Same sources and math as the dashboard (streak.ts, practice-calendar.ts,
// achievements). Pure.

import { ACHIEVEMENTS } from '@/lib/achievements'
import { buildPracticeCalendar, WEEK_GOAL } from './practice-calendar'
import { computeStreaks } from './streak'

export interface CelebrationMilestone {
  key: string
  title: string
  iconName: string
  unit: 'lessons' | 'days'
  requirement: number
  before: number
  after: number
}

export interface CelebrationStats {
  streak: { before: number; after: number }
  week: { before: number; after: number; goal: number }
  milestones: CelebrationMilestone[]
}

const LESSON_KEYS = ['first_lesson', 'lessons_10', 'lessons_25', 'lessons_50', 'lessons_100']
const STREAK_KEYS = ['streak_3', 'streak_7', 'streak_30']

function nextMilestone(keys: string[], unit: CelebrationMilestone['unit'], before: number, after: number): CelebrationMilestone | null {
  const achievement = keys.map(key => ACHIEVEMENTS[key]).find(a => a && a.requirement > before)
  if (!achievement) return null
  return { key: achievement.key, title: achievement.title, iconName: achievement.iconName, unit, requirement: achievement.requirement, before, after }
}

/**
 * `dateKeys`: one local day key per completed lesson part (the dashboard's source); `added`: parts
 * completed this visit and not yet in `dateKeys`; `lessonToday`: parts of THIS lesson already in
 * `dateKeys` for today (saved earlier in the visit and picked up by a later server render). "Before"
 * is the student's state before this lesson's work today, so a lesson that started today's streak
 * still shows it growing.
 */
export function celebrationStats(dateKeys: string[], today: string, added: number, lessonToday = 0): CelebrationStats {
  let drop = Math.max(0, lessonToday)
  const beforeKeys = dateKeys.filter(key => !(key === today && drop > 0 && drop-- > 0))
  const afterKeys = [...dateKeys, ...Array.from({ length: Math.max(0, added) }, () => today)]
  const streakBefore = computeStreaks(beforeKeys, today).current
  const streakAfter = computeStreaks(afterKeys, today).current
  const milestones = [
    nextMilestone(LESSON_KEYS, 'lessons', beforeKeys.length, afterKeys.length),
    nextMilestone(STREAK_KEYS, 'days', streakBefore, streakAfter),
  ].filter((m): m is CelebrationMilestone => m !== null)
  return {
    streak: { before: streakBefore, after: streakAfter },
    week: { before: buildPracticeCalendar(beforeKeys, today, 1).weekDoneCount, after: buildPracticeCalendar(afterKeys, today, 1).weekDoneCount, goal: WEEK_GOAL },
    milestones,
  }
}
