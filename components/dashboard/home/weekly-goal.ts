// The weekly goal line, shared by the streak card and the greeting chip so both
// say the same thing. Above the goal the count is capped at the goal and the
// extra lessons are shown on their own ("6 of 6 lessons · +3 extra"), never "9 of 6".

type T = (key: string, params?: Record<string, string | number>) => string

export function weeklyGoalText(t: T, done: number, goal: number): string {
  return done > goal
    ? t('dashboard.pages.home.streak.goalExceeded', { goal, extra: done - goal })
    : t('dashboard.pages.home.streak.goalProgress', { done, goal })
}
