// The Ready check's three panels (sound, input, timing) as states. Pure.

import type { AudioMode } from './input-modes'

export type CheckState = 'todo' | 'running' | 'done' | 'skipped'

export interface ReadyInput {
  audioMode: AudioMode | null
  /** The mic test is open (mic modes). */
  micOpen: boolean
  /** The mic has heard the student at least once. */
  micHeard: boolean
  /** A saved calibration exists for this input. */
  calibrated: boolean
  calibrating: boolean
  bleConnected: boolean
}

export interface ReadyChecks { sound: CheckState; input: CheckState; timing: CheckState; canStart: boolean }

export function readyChecks(i: ReadyInput): ReadyChecks {
  const sound: CheckState = i.audioMode ? 'done' : 'todo'
  const input: CheckState = i.audioMode === 'midi' ? 'done'
    : i.audioMode === 'playsense' ? (i.bleConnected ? 'done' : 'todo')
      : i.audioMode && i.micHeard ? 'done'
        : i.audioMode && i.micOpen ? 'running' : 'todo'
  const timing: CheckState = i.audioMode === 'midi' ? 'skipped'
    : i.calibrating ? 'running' : i.calibrated ? 'done' : 'todo'
  // Timing and the mic level are advice, as today: only the input choice is required.
  // A measurement in progress holds Start (the take would talk over the clicks).
  return { sound, input, timing, canStart: sound === 'done' && !i.calibrating }
}
