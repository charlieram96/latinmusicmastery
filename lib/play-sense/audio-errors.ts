// The input hooks (mic, MIDI, PlaySense) report failures as English sentences.
// This maps the ones they raise to translation keys, so the lesson shows them
// in the student's language; anything unknown is shown as the hook wrote it.
// A test checks every message here still exists in the hooks. Pure.

const BASE = 'dashboard.classViewer.exercise.audioErrors'

export const AUDIO_ERROR_KEYS: Record<string, string> = {
  'Web Audio API is not supported in this browser.': `${BASE}.webAudio`,
  'Microphone permission was denied. Click the lock/site-info icon in your address bar, allow microphone access, then click Play to retry.': `${BASE}.micDenied`,
  'No microphone found. Please connect a microphone and try again.': `${BASE}.micMissing`,
  'Your microphone is in use by another app. Close other apps that might be using it and try again.': `${BASE}.micBusy`,
  'Audio processor failed to load. Refresh the page (the AudioWorklet must be served over HTTPS or localhost).': `${BASE}.worklet`,
  'Could not access the microphone. Please try again.': `${BASE}.micFailed`,
  'MIDI is unavailable in this browser. Open PlaySense in a browser with Web MIDI support, or choose microphone input.': `${BASE}.midiUnsupported`,
  'No MIDI instrument is connected. Connect your keyboard, then press Play.': `${BASE}.midiMissing`,
  'MIDI permission was denied. Allow MIDI access in your browser and try again.': `${BASE}.midiDenied`,
  'Could not connect to your MIDI instrument. Check the connection and try again.': `${BASE}.midiFailed`,
  'No PlaySense device connected. Connect your device and try again.': `${BASE}.bleMissing`,
  'Could not start the PlaySense input. Check your connection and try again.': `${BASE}.bleFailed`,
  'Web Bluetooth is not supported in this browser. Please use Chrome or Edge.': `${BASE}.bleUnsupported`,
  'PlaySense device disconnected and could not reconnect.': `${BASE}.bleDisconnected`,
}

export function audioErrorKey(message: string | null | undefined): string | null {
  return message ? AUDIO_ERROR_KEYS[message] ?? null : null
}
