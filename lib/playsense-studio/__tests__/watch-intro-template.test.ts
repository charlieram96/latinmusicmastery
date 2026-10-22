import { expect, it } from 'vitest'
import { CASCARA_RIGHT_HAND_ITEM, CASCARA_RIGHT_HAND_WATCH, withWatchIntro } from '../watch-intro-template'

it('prepends the local Watch opening without changing PlaySense media or authored timing', () => {
  const item = { id: CASCARA_RIGHT_HAND_ITEM, video_url: '/watch-original.mp4', exercise_video_url: '/play.mp4', play_bar1_seconds: 7.3, active_time_map_id: 'map', video_trim_in_seconds: 1 }
  const result = withWatchIntro(item)
  expect(result.video_url).toBe(CASCARA_RIGHT_HAND_WATCH)
  expect(result.exercise_video_url).toBe(item.exercise_video_url)
  expect(result.play_bar1_seconds).toBe(7.3)
  expect(result.active_time_map_id).toBe('map')
  expect(result.video_trim_in_seconds).toBe(0)
  expect(item.video_url).toBe('/watch-original.mp4')
  expect(withWatchIntro(result)).toEqual(result)
})
it('keeps other videos intact to avoid duplicating an existing intro', () => {
  const item = {id:'other',video_url:'/other.mp4'}
  expect(withWatchIntro(item)).toBe(item)
})
