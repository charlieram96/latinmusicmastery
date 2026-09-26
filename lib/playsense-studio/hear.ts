// PlaySense Studio — what the admin hears while syncing: the recording, the
// written score (ScoreSynth), or both. Per-viewer, stored in localStorage.

export type Hear = 'recording' | 'score' | 'both';

export const HEAR_KEY = 'playsense-studio:hear';
export const HEAR_OPTIONS: ReadonlyArray<{ value: Hear; label: string }> = [
  { value: 'recording', label: 'Recording' },
  { value: 'score', label: 'Score' },
  { value: 'both', label: 'Both' },
];

/** The stored choice, or Recording when there is none (or storage throws). */
export function readHear(): Hear {
  try {
    const raw = window.localStorage.getItem(HEAR_KEY);
    return raw === 'score' || raw === 'both' ? raw : 'recording';
  } catch {
    return 'recording';
  }
}

export function writeHear(hear: Hear): void {
  try {
    window.localStorage.setItem(HEAR_KEY, hear);
  } catch {
    /* not persisting is fine */
  }
}

/**
 * The video element's `muted`: Score silences the recording; Recording and
 * Both follow the admin's own mute, which Score never overwrites.
 */
export function hearMute(hear: Hear, adminMuted: boolean): boolean {
  return hear === 'score' || adminMuted;
}
