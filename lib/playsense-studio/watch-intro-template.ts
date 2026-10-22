/** User-supplied opening, reserved for Watch (never exercise_video_url). */
export const WATCH_INTRO_TEMPLATE = '/local-course-assets/templates/watch-logo-intro.mp4'
export const CASCARA_RIGHT_HAND_ITEM = 'f7fee0dd-66bb-4e08-9af0-e38febfa415b'
export const CASCARA_RIGHT_HAND_WATCH = '/local-course-assets/templates/cascara-right-hand-watch-intro.mp4'

/** Local presentation override. Timing stays authored: the user will realign it manually. */
export function withWatchIntro<T extends { id: string }>(item: T): T {
  if (item.id !== CASCARA_RIGHT_HAND_ITEM) return item
  return {
    ...item,
    video_url: CASCARA_RIGHT_HAND_WATCH,
    video_duration_seconds: 22.022,
    video_trim_in_seconds: 0,
    video_trim_out_seconds: null,
  }
}
