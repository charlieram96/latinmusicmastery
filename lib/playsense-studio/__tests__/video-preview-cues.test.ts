import { expect, it } from 'vitest'
import { SOBAO_OVERHEAD_START, videoPreviewCues, videoRoundAt } from '../video-preview-cues'
it('keeps precision readable before the longer front-shot guides', () => {
  for (const time of [3.75, 5, 6.1]) {
    expect(videoPreviewCues(time, 22, true, false).tip).toBe(0)
    expect(videoPreviewCues(time, 22, true, false).annotations).toEqual([])
  }
  expect(videoPreviewCues(7, 22, true, false).annotations).toEqual(['cascara'])
  expect(videoPreviewCues(10, 22, true, false).annotations).toEqual(['cascara', 'sobao-front'])
  expect(videoPreviewCues(13, 22, true, false).annotations).toEqual(['sobao-front'])
})
it('switches positions at the camera cut and brings overhead cascara in earlier', () => {
  expect(videoPreviewCues(SOBAO_OVERHEAD_START, 22, true, false).annotations).toEqual(['sobao-overhead'])
  const overlap = videoPreviewCues(19.5, 22, true, false)
  expect(overlap.annotations).toEqual(['sobao-overhead', 'cascara-overhead'])
  expect(overlap.tip).toBe(-1)
  expect(overlap.roundCounter).toBe(false)
  expect(videoPreviewCues(18, 22, true, false).annotations).toContain('cascara-overhead')
  expect(videoPreviewCues(20.5, 22, true, false).annotations).toEqual(['cascara-overhead'])
  expect(videoPreviewCues(21.8, 22, true, false).technique).toBe(false)
})
it('reserves the last-round announcement and leaves other videos unchanged', () => {
  expect(videoPreviewCues(1, 22, true, true).finalNotice).toBe(true)
  expect(videoPreviewCues(1, 22, true, true).roundCounter).toBe(false)
  expect(videoPreviewCues(10, 22, false, false).annotations).toEqual([])
})

it('counts five rounds every two measures without replaying and honors the beat anchor', () => {
  expect([0, 4, 8, 12, 16, 22].map(time => videoRoundAt(time, 120, 0, 5).round)).toEqual([1, 2, 3, 4, 5, 5])
  expect(videoRoundAt(5.9, 120, 2, 5).round).toBe(1)
  expect(videoRoundAt(6, 120, 2, 5).round).toBe(2)
  expect(videoRoundAt(8, 60, 0, 5).round).toBe(2)
  expect(videoPreviewCues(16, 22, true, true, 0).finalNotice).toBe(true)
  expect(videoPreviewCues(19, 22, true, true, 3).finalNotice).toBe(false)
})
