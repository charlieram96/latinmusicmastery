'use client';

import { useEffect, useRef, useState } from 'react';

type MidiInputStatus = 'idle' | 'ready' | 'unavailable';

/** Requests Web MIDI once and listens on every input, including ones connected later.
 * No SysEx, no microphone. Detaches its listeners whenever disabled or unmounted. */
export function useMidiInput(enabled: boolean, onNoteOn: (midi: number, atMs: number) => void): { status: MidiInputStatus } {
  const [status, setStatus] = useState<MidiInputStatus>('idle');
  const onNoteOnRef = useRef(onNoteOn);
  const accessPromiseRef = useRef<Promise<MIDIAccess> | null>(null);
  useEffect(() => { onNoteOnRef.current = onNoteOn; }, [onNoteOn]);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const handleMessage = (event: MIDIMessageEvent) => {
      const data = event.data;
      if (!data || data.length < 3) return;
      if ((data[0] & 0xf0) !== 0x90 || data[2] <= 0) return;
      onNoteOnRef.current(data[1], event.timeStamp);
    };
    const attach = (access: MIDIAccess) => {
      access.inputs.forEach(input => input.addEventListener('midimessage', handleMessage));
    };
    const detach = (access: MIDIAccess) => {
      access.inputs.forEach(input => input.removeEventListener('midimessage', handleMessage));
    };
    const handleStateChange = () => {
      accessPromiseRef.current?.then(access => { if (!cancelled) attach(access); }).catch(() => {});
    };
    let access: MIDIAccess | null = null;

    (async () => {
      if (!accessPromiseRef.current) {
        accessPromiseRef.current = navigator.requestMIDIAccess
          ? navigator.requestMIDIAccess({ sysex: false })
          : Promise.reject(new Error('This browser does not support Web MIDI.'));
        accessPromiseRef.current.catch(() => {});
      }
      try {
        access = await accessPromiseRef.current;
        if (cancelled) return;
        attach(access);
        access.addEventListener('statechange', handleStateChange);
        setStatus('ready');
      } catch {
        if (!cancelled) setStatus('unavailable');
      }
    })();

    return () => {
      cancelled = true;
      if (access) {
        detach(access);
        access.removeEventListener('statechange', handleStateChange);
      }
    };
  }, [enabled]);

  return { status };
}
