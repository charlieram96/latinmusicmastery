/** Presentation clock only. Input timestamps and scoring remain on the render clock. */
export function audibleTime(context: AudioContext, nowMs = performance.now()): number {
  if (context.state !== 'running') return context.currentTime
  const stamp = context.getOutputTimestamp?.()
  if (stamp && typeof stamp.contextTime === 'number' && typeof stamp.performanceTime === 'number' && stamp.contextTime > 0 && stamp.performanceTime > 0) {
    return Math.max(0, Math.min(context.currentTime, stamp.contextTime + Math.max(0, nowMs-stamp.performanceTime)/1000))
  }
  return Math.max(0, context.currentTime-(context.outputLatency || 0)-(context.baseLatency || 0))
}
