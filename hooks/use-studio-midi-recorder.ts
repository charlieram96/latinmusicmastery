'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { MAX_TAKE_MS, MAX_TAKE_NOTES, MidiNoteCapture, type MidiTake } from '@/lib/playsense-studio/midi-recording';

type MidiInputChoice = { id: string; name: string };
type RecordingOptions = { bpm: number; timeSignature: [number, number]; countIn: boolean; click: boolean; sustain: boolean };
type Session = { capture: MidiNoteCapture; origin: number; options: RecordingOptions; audio: AudioContext; interval: ReturnType<typeof setInterval>; nextBeat: number };

/** Own listeners, one selected port, no microphone or SysEx access. */
export function useStudioMidiRecorder() {
  const [inputs, setInputs] = useState<MidiInputChoice[]>([]);
  const [selectedInput, setSelectedInput] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connected, setConnected] = useState(false);
  const [phase, setPhase] = useState<'idle' | 'starting' | 'count-in' | 'recording' | 'review'>('idle');
  const [take, setTake] = useState<MidiTake | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meter, setMeter] = useState({ count: 0, elapsedMs: 0, countdown: 0, pitches: [] as number[] });
  const accessRef = useRef<MIDIAccess | null>(null);
  const inputRef = useRef<MIDIInput | null>(null);
  const selectedRef = useRef('');
  const sessionRef = useRef<Session | null>(null);
  const startingAudio = useRef<AudioContext | null>(null);
  const generation = useRef(0);
  const mounted = useRef(true);
  const messageRef = useRef<(event: MIDIMessageEvent) => void>(() => {});
  const changeRef = useRef<() => void>(() => {});
  const stopRef = useRef<(reason?: string) => void>(() => {});
  const onMessage = useCallback((event: MIDIMessageEvent) => messageRef.current(event), []);
  const onChange = useCallback(() => changeRef.current(), []);

  const releaseSession = useCallback(() => {
    const session = sessionRef.current;
    sessionRef.current = null;
    if (session) { clearInterval(session.interval); void session.audio.close().catch(() => {}); }
    const audio = startingAudio.current;
    startingAudio.current = null;
    if (audio && audio.state !== 'closed') void audio.close().catch(() => {});
    return session;
  }, []);

  const stop = useCallback((reason?: string) => {
    generation.current++;
    const session = releaseSession();
    if (!mounted.current) return;
    if (session) {
      const durationMs = Math.max(0, Math.min(MAX_TAKE_MS, performance.now() - session.origin));
      const notes = session.capture.finish(durationMs);
      setTake(notes.length ? { notes, durationMs, bpm: session.options.bpm, timeSignature: session.options.timeSignature } : null);
      setPhase(notes.length ? 'review' : 'idle');
      setMeter({ count: notes.length, elapsedMs: durationMs, pitches: [], countdown: 0 });
      setError(reason ?? (notes.length ? null : 'No notes were recorded. Play after the count-in, then stop.'));
    } else setPhase('idle');
  }, [releaseSession]);
  useEffect(() => { stopRef.current = stop; }, [stop]);

  const bindInput = useCallback((input: MIDIInput | null) => {
    inputRef.current?.removeEventListener('midimessage', onMessage);
    inputRef.current = input;
    selectedRef.current = input?.id ?? '';
    input?.addEventListener('midimessage', onMessage);
    if (mounted.current) setSelectedInput(input?.id ?? '');
  }, [onMessage]);

  useEffect(() => {
    messageRef.current = event => {
      const session = sessionRef.current;
      if (!event.data || !session) return;
      const now = performance.now();
      const stamp = event.timeStamp > 0 && event.timeStamp <= now + 1000 ? event.timeStamp : now;
      session.capture.message(event.data, stamp - session.origin);
      if (session.capture.count >= MAX_TAKE_NOTES) stopRef.current('The take reached the note limit. Your recording is ready to review.');
    };
    changeRef.current = () => {
      const choices = [...(accessRef.current?.inputs.values() ?? [])].filter(input => input.state === 'connected');
      setInputs(choices.map(input => ({ id: input.id, name: input.name || input.manufacturer || 'MIDI instrument' })));
      const selected = choices.find(input => input.id === selectedRef.current);
      if (inputRef.current && !selected) stopRef.current('The MIDI instrument disconnected. Any captured notes have been kept.');
      bindInput(selected ?? choices[0] ?? null);
    };
  }, [bindInput]);

  const connect = useCallback(async () => {
    if (accessRef.current) { changeRef.current(); return; }
    if (!navigator.requestMIDIAccess) { setError('This browser does not support MIDI. Open Studio in a browser with Web MIDI support.'); return; }
    const token = ++generation.current;
    setConnecting(true); setError(null);
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      if (!mounted.current || token !== generation.current) return;
      accessRef.current = access;
      access.addEventListener('statechange', onChange);
      setConnected(true);
      changeRef.current();
    } catch (err) {
      if (mounted.current && token === generation.current) setError(err instanceof DOMException && err.name === 'NotAllowedError'
        ? 'Allow MIDI access in your browser, then try connecting again.' : 'Could not connect to MIDI. Check your instrument connection and try again.');
    } finally { if (mounted.current && token === generation.current) setConnecting(false); }
  }, [onChange]);

  const selectInput = useCallback((id: string) => {
    if (sessionRef.current || startingAudio.current) return;
    bindInput(accessRef.current?.inputs.get(id) ?? null);
    setError(null);
  }, [bindInput]);

  const start = useCallback(async (options: RecordingOptions) => {
    if (sessionRef.current || startingAudio.current) return;
    if (!inputRef.current || inputRef.current.state !== 'connected') { setError('Connect and select a MIDI instrument first.'); return; }
    if (!Number.isFinite(options.bpm) || options.bpm < 20 || options.bpm > 400) { setError('Choose a tempo between 20 and 400 BPM.'); return; }
    const token = ++generation.current;
    setError(null); setPhase('starting');
    let audio: AudioContext | null = null;
    try {
      audio = new AudioContext();
      startingAudio.current = audio;
      await audio.resume();
      if (!mounted.current || token !== generation.current || !inputRef.current || inputRef.current.state !== 'connected') {
        if (audio.state !== 'closed') await audio.close();
        if (mounted.current && token === generation.current) { startingAudio.current = null; setPhase('idle'); setError('The MIDI instrument disconnected. Reconnect and try again.'); }
        return;
      }
      const beatSeconds = 60 / options.bpm * 4 / options.timeSignature[1];
      const count = options.countIn ? options.timeSignature[0] : 0;
      const countOrigin = audio.currentTime + .08;
      const origin = performance.now() + (countOrigin + count * beatSeconds - audio.currentTime) * 1000;
      const session: Session = { audio, options, origin, capture: new MidiNoteCapture(options.sustain), nextBeat: 0, interval: 0 as unknown as ReturnType<typeof setInterval> };
      sessionRef.current = session; startingAudio.current = null;
      setTake(null); setMeter({ count: 0, elapsedMs: 0, pitches: [], countdown: count });
      const tick = () => {
        if (sessionRef.current !== session) return;
        const elapsed = performance.now() - origin;
        if (elapsed >= MAX_TAKE_MS) { stopRef.current('The three-minute take limit was reached. Your notes are ready to review.'); return; }
        if (audio!.state !== 'running') { stopRef.current('Recording stopped because the audio clock was interrupted. Your notes have been kept.'); return; }
        // Skip missed clicks after timer throttling; timing remains tied to the original clock.
        session.nextBeat = Math.max(session.nextBeat, Math.ceil((audio!.currentTime - countOrigin) / beatSeconds));
        while (countOrigin + session.nextBeat * beatSeconds < audio!.currentTime + .1) {
          const index = session.nextBeat++;
          const when = countOrigin + index * beatSeconds;
          if (options.click || index < count) {
            const oscillator = audio!.createOscillator(); const gain = audio!.createGain();
            oscillator.frequency.value = index % options.timeSignature[0] === 0 ? 1100 : 760;
            gain.gain.setValueAtTime(.09, when); gain.gain.exponentialRampToValueAtTime(.001, when + .035);
            oscillator.connect(gain); gain.connect(audio!.destination);
            oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
            oscillator.start(when); oscillator.stop(when + .04);
          }
        }
        setPhase(elapsed < 0 ? 'count-in' : 'recording');
        setMeter({ count: session.capture.count, elapsedMs: Math.max(0, elapsed), pitches: session.capture.pitches,
          countdown: elapsed < 0 ? Math.min(count, Math.ceil(-elapsed / (beatSeconds * 1000))) : 0 });
      };
      session.interval = setInterval(tick, 33);
      tick();
    } catch {
      if (sessionRef.current?.audio === audio) { clearInterval(sessionRef.current.interval); sessionRef.current = null; }
      if (audio && audio.state !== 'closed') void audio.close().catch(() => {});
      if (mounted.current && token === generation.current) { startingAudio.current = null; setPhase('idle'); setError('Could not start the recording clock. Try again.'); }
    }
  }, []);

  const discard = useCallback(() => {
    generation.current++; releaseSession();
    setTake(null); setPhase('idle'); setError(null); setConnecting(false);
    setMeter({ count: 0, elapsedMs: 0, countdown: 0, pitches: [] });
  }, [releaseSession]);

  useEffect(() => {
    mounted.current = true;
    const lifecycleGeneration = generation;
    const visibility = () => { if (document.visibilityState === 'hidden' && (sessionRef.current || startingAudio.current)) stopRef.current('Recording stopped when you left this tab. Review your captured notes or record another take.'); };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      mounted.current = false; lifecycleGeneration.current++; releaseSession();
      inputRef.current?.removeEventListener('midimessage', onMessage);
      accessRef.current?.removeEventListener('statechange', onChange);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [onMessage, onChange, releaseSession]);
  return { inputs, selectedInput, connecting, connected, phase, take, error, meter, connect, selectInput, start, stop, discard };
}
