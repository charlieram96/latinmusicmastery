export type CrumbKind = 'date' | 'home'

export interface PageTitle {
  /** i18n key for the header title. */
  titleKey: string
  /** What the small line above the title shows: today's date on the home page, "Home" elsewhere. */
  crumb: CrumbKind
}

const HOME: PageTitle = { titleKey: 'dashboard.nav.home', crumb: 'date' }

/** First path segment after /dashboard → title key. */
const SEGMENT_TITLES: Record<string, string> = {
  courses: 'dashboard.nav.browseCourses',
  'my-courses': 'dashboard.nav.myCourses',
  course: 'dashboard.nav.myCourses',
  modules: 'dashboard.nav.myCourses',
  teachers: 'dashboard.nav.teachers',
  'master-class': 'dashboard.nav.masterClass',
  achievements: 'dashboard.nav.achievements',
  feedback: 'dashboard.nav.teacherFeedback',
  community: 'dashboard.nav.community',
  tuner: 'dashboard.nav.tuner',
  'play-sense': 'dashboard.nav.playSense',
  subscription: 'dashboard.nav.subscription',
  subscribe: 'dashboard.pages.subscribe.title',
  settings: 'dashboard.nav.settings',
  progress: 'dashboard.pages.progress.title',
  help: 'dashboard.pages.help.title',
}

/** Resolves the contextual header's title and crumb from the current pathname. */
export function resolvePageTitle(pathname: string): PageTitle {
  const path = pathname.split('?')[0].replace(/\/+$/, '')
  const rest = path.startsWith('/dashboard') ? path.slice('/dashboard'.length) : path
  const segment = rest.split('/').filter(Boolean)[0]
  if (!segment) return HOME
  const titleKey = SEGMENT_TITLES[segment]
  return titleKey ? { titleKey, crumb: 'home' } : HOME
}
