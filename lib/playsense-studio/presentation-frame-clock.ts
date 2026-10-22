/** Follow the frame submitted to the compositor, not the independently advancing
 * media clock. Keep the callback pending while paused so seeks also update it.
 */
export function observePresentationFrames(video: HTMLVideoElement, update: (seconds: number) => void) {
  let active = true
  let handle = 0
  if (typeof video.requestVideoFrameCallback === 'function') {
    const frame: VideoFrameRequestCallback = (_now, metadata) => {
      if (!active) return
      update(metadata.mediaTime)
      handle = video.requestVideoFrameCallback(frame)
    }
    handle = video.requestVideoFrameCallback(frame)
    return () => { active = false; video.cancelVideoFrameCallback(handle) }
  }
  // Older browsers have no decoded-frame API. Avoid a separate timer.
  const tick = () => {
    if (!active) return
    update(video.currentTime)
    handle = requestAnimationFrame(tick)
  }
  handle = requestAnimationFrame(tick)
  return () => { active = false; cancelAnimationFrame(handle) }
}
