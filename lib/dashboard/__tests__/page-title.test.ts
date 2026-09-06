import { describe, expect, it } from 'vitest'
import { resolvePageTitle } from '../page-title'

describe('resolvePageTitle', () => {
  it('shows the date crumb on the home page', () => {
    expect(resolvePageTitle('/dashboard')).toEqual({ titleKey: 'dashboard.nav.home', crumb: 'date' })
    expect(resolvePageTitle('/dashboard/')).toEqual({ titleKey: 'dashboard.nav.home', crumb: 'date' })
  })

  it('maps first-level routes to their nav or page title keys', () => {
    expect(resolvePageTitle('/dashboard/courses').titleKey).toBe('dashboard.nav.browseCourses')
    expect(resolvePageTitle('/dashboard/my-courses').titleKey).toBe('dashboard.nav.myCourses')
    expect(resolvePageTitle('/dashboard/teachers').titleKey).toBe('dashboard.nav.teachers')
    expect(resolvePageTitle('/dashboard/master-class').titleKey).toBe('dashboard.nav.masterClass')
    expect(resolvePageTitle('/dashboard/achievements').titleKey).toBe('dashboard.nav.achievements')
    expect(resolvePageTitle('/dashboard/feedback').titleKey).toBe('dashboard.nav.teacherFeedback')
    expect(resolvePageTitle('/dashboard/community').titleKey).toBe('dashboard.nav.community')
    expect(resolvePageTitle('/dashboard/tuner').titleKey).toBe('dashboard.nav.tuner')
    expect(resolvePageTitle('/dashboard/play-sense').titleKey).toBe('dashboard.nav.playSense')
    expect(resolvePageTitle('/dashboard/subscription').titleKey).toBe('dashboard.nav.subscription')
    expect(resolvePageTitle('/dashboard/settings').titleKey).toBe('dashboard.nav.settings')
    expect(resolvePageTitle('/dashboard/progress').titleKey).toBe('dashboard.pages.progress.title')
    expect(resolvePageTitle('/dashboard/help').titleKey).toBe('dashboard.pages.help.title')
    expect(resolvePageTitle('/dashboard/subscribe').titleKey).toBe('dashboard.pages.subscribe.title')
  })

  it('uses the home crumb on sub-pages', () => {
    expect(resolvePageTitle('/dashboard/courses').crumb).toBe('home')
  })

  it('treats course, class and module routes as part of My Courses', () => {
    expect(resolvePageTitle('/dashboard/course/abc').titleKey).toBe('dashboard.nav.myCourses')
    expect(resolvePageTitle('/dashboard/course/abc/class/def').titleKey).toBe('dashboard.nav.myCourses')
    expect(resolvePageTitle('/dashboard/modules/xyz').titleKey).toBe('dashboard.nav.myCourses')
  })

  it('ignores query strings and trailing slashes', () => {
    expect(resolvePageTitle('/dashboard/courses/?style=salsa').titleKey).toBe('dashboard.nav.browseCourses')
  })

  it('falls back to home for unknown routes', () => {
    expect(resolvePageTitle('/dashboard/whatever').titleKey).toBe('dashboard.nav.home')
  })
})
