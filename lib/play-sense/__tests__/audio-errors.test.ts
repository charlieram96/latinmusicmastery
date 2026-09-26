import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en.json'
import es from '@/locales/es.json'
import { AUDIO_ERROR_KEYS, audioErrorKey } from '../audio-errors'

const lookup = (dict: unknown, path: string) => path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], dict)

describe('audioErrorKey (L10)', () => {
  it('maps the input hooks’ messages to translation keys', () => {
    expect(audioErrorKey('No microphone found. Please connect a microphone and try again.')).toBe('dashboard.classViewer.exercise.audioErrors.micMissing')
    expect(audioErrorKey('No MIDI instrument is connected. Connect your keyboard, then press Play.')).toBe('dashboard.classViewer.exercise.audioErrors.midiMissing')
  })

  it('leaves unknown messages alone', () => {
    expect(audioErrorKey('Something new')).toBeNull()
    expect(audioErrorKey(null)).toBeNull()
  })

  it('every mapped message still exists in the hooks that raise it', () => {
    const sources = ['hooks/use-onset-detection.ts', 'hooks/use-midi-onsets.ts', 'hooks/use-playsense-onsets.ts', 'contexts/playsense-context.tsx']
      .map(file => readFileSync(join(process.cwd(), file), 'utf8')).join('\n')
    for (const message of Object.keys(AUDIO_ERROR_KEYS)) expect(sources, message).toContain(message)
  })

  it('every key is translated in English and Spanish', () => {
    for (const key of Object.values(AUDIO_ERROR_KEYS)) {
      expect(typeof lookup(en, key), key).toBe('string')
      expect(typeof lookup(es, key), key).toBe('string')
    }
  })
})
