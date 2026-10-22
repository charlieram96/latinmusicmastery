import { expect, it, vi } from 'vitest'
import { observePresentationFrames } from '../presentation-frame-clock'

it('uses presented mediaTime despite a disagreeing playback clock, including paused seeks', () => {
  let callback: VideoFrameRequestCallback
  let id = 0
  const cancel = vi.fn()
  const video = {
    currentTime: 52, paused: true,
    requestVideoFrameCallback: vi.fn((cb: VideoFrameRequestCallback) => { callback = cb; return ++id }),
    cancelVideoFrameCallback: cancel,
  } as unknown as HTMLVideoElement
  const update = vi.fn()
  const stop = observePresentationFrames(video, update)
  for (const seconds of [29.963266666666666, 38.90553333333333, 41.5415, 51.618233333333336, 41.5415]) {
    callback!(0, { mediaTime: seconds } as VideoFrameCallbackMetadata)
    expect(update).toHaveBeenLastCalledWith(seconds)
  }
  expect(update).not.toHaveBeenCalledWith(52)
  stop()
  expect(cancel).toHaveBeenCalledWith(6)
  callback!(0, { mediaTime: 90 } as VideoFrameCallbackMetadata)
  expect(update).toHaveBeenCalledTimes(5)
})
