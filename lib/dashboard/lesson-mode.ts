/** The lesson player takes the whole screen: no dashboard rail, header or tab bar. */
const LESSON_PATH = /^\/dashboard\/course\/[^/]+\/class\/[^/]+\/?$/

export function isLessonModePath(pathname: string | null | undefined): boolean {
  return !!pathname && LESSON_PATH.test(pathname)
}
