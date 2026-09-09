'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { OnsetEvent } from '@/lib/play-sense/types'
import { decodeMidiNote, inputTimestampToAudioTime } from '@/lib/play-sense/input-events'

/** Direct MIDI note messages share the session's audio-clock origin. No microphone is opened. */
export function useMidiOnsets() {
  const [isListening, setIsListening] = useState(false)
  const [hasPermission, setHasPermission] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [inputLevel, setInputLevel] = useState(0)
  const [recentOnsets, setRecentOnsets] = useState<OnsetEvent[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)
  const accessRef = useRef<MIDIAccess | null>(null)
  const heldNotes = useRef(new Set<number>())
  const generation = useRef(0)
  const clearOnsets = useCallback(() => setRecentOnsets([]), [])
  const stopListening = useCallback(() => {
    generation.current++
    const access = accessRef.current
    if (access) {
      access.onstatechange = null
      access.inputs.forEach(input => { input.onmidimessage = null; void input.close() })
    }
    accessRef.current = null
    const context = audioContextRef.current
    audioContextRef.current = null
    if (context && context.state !== 'closed') void context.close()
    heldNotes.current.clear()
    setIsListening(false); setInputLevel(0)
  }, [])

  const startListening = useCallback(async (): Promise<AudioContext | null> => {
    if (audioContextRef.current?.state === 'running' && accessRef.current) return audioContextRef.current
    setError(null)
    if (!navigator.requestMIDIAccess) {
      setError('MIDI is unavailable in this browser. Open PlaySense in a browser with Web MIDI support, or choose microphone input.')
      return null
    }
    const token = ++generation.current
    let context: AudioContext | null = null
    try {
      context = new AudioContext()
      await context.resume()
      const access = await navigator.requestMIDIAccess({ sysex: false })
      if (token !== generation.current) { await context.close(); return null }
      audioContextRef.current = context; accessRef.current = access; setHasPermission(true)
      const attach = () => {
        let connected = 0
        access.inputs.forEach(input => {
          if (input.state !== 'connected') { input.onmidimessage = null; return }
          connected++
          input.onmidimessage = event => {
            if (!event.data || context?.state !== 'running') return
            const note = decodeMidiNote(event.data)
            if (!note) return
            if (note.on) {
              heldNotes.current.add(note.note)
              const onset: OnsetEvent = {
                timestamp: inputTimestampToAudioTime(event.timeStamp, performance.now(), context.currentTime),
                energy: note.velocity, midiNote: note.note,
                frequency: 440 * 2 ** ((note.note - 69) / 12),
              }
              setRecentOnsets(prev => [...prev.slice(-499), onset])
              setInputLevel(note.velocity)
            } else {
              heldNotes.current.delete(note.note)
              if (!heldNotes.current.size) setInputLevel(0)
            }
          }
        })
        setIsListening(connected > 0)
        setError(connected ? null : 'No MIDI instrument is connected. Connect your keyboard, then press Play.')
      }
      access.onstatechange = attach
      attach()
      if (![...access.inputs.values()].some(input => input.state === 'connected')) {
        stopListening()
        return null
      }
      setRecentOnsets([])
      return context
    } catch (err) {
      if (context && context.state !== 'closed') await context.close()
      if (token !== generation.current) return null
      setHasPermission(false)
      setError(err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'MIDI permission was denied. Allow MIDI access in your browser and try again.'
        : 'Could not connect to your MIDI instrument. Check the connection and try again.')
      return null
    }
  }, [stopListening])

  useEffect(() => () => { stopListening() }, [stopListening])
  return { isListening, hasPermission, error, inputLevel, recentOnsets, startListening, stopListening, clearOnsets }
}
