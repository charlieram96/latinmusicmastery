import type { OnsetEvent } from './types'

/** A bounded input history rolls over; array length is not an event cursor. */
export function consumeOnsets(events: OnsetEvent[], seen: WeakSet<OnsetEvent>, startTime: number): OnsetEvent[] {
  const fresh: OnsetEvent[] = []
  for (const event of events) {
    if (seen.has(event)) continue
    seen.add(event)
    if (event.timestamp >= startTime) fresh.push(event)
  }
  return fresh
}

/** MIDI/DOM timestamps and BLE receive times use performance.now(), not epoch time. */
export function inputTimestampToAudioTime(receivedMs: number, nowMs: number, audioTime: number): number {
  return audioTime - Math.max(0, nowMs - receivedMs) / 1000
}

export function decodeMidiNote(data: ArrayLike<number>): { note: number; velocity: number; on: boolean } | null {
  if (data.length < 3) return null
  const status = data[0] & 0xf0
  if ((status !== 0x90 && status !== 0x80) || data[1] > 127 || data[2] > 127) return null
  return { note: data[1], velocity: data[2] / 127, on: status === 0x90 && data[2] > 0 }
}
