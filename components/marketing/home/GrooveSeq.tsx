'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslation } from '@/components/language-provider'
import { INST_IDS, antic, detectClave, initialPattern, toggleCell, vel, withClave, type ClaveKey, type InstId, type Pattern } from '@/lib/marketing/groove/patterns'
import { createGroove, type Groove } from '@/lib/marketing/groove/audio'

const COLORS: Record<InstId, string> = { clave: '#F6EBDD', campana: '#FFC94D', conga: '#FF5A48', bajo: '#2FD1B5', piano: '#A58BFF' }
const CLAVE_BUTTONS: ClaveKey[] = ['son32', 'son23', 'rumba32']
const BPM = { min: 120, max: 232, step: 8, initial: 184 }

/**
 * The 5×16 son montuno step grid. Still until the visitor presses play; tap a
 * row name to mute it, tap a cell to change the pattern.
 */
export function GrooveSeq() {
  const { t } = useTranslation()
  const k = (s: string, p?: Record<string, string | number>) => t(`marketing.site.home.groove.${s}`, p)
  const [pattern, setPattern] = useState<Pattern>(() => initialPattern())
  const [muted, setMuted] = useState<Set<InstId>>(() => new Set())
  const [playing, setPlaying] = useState(false)
  const [step, setStep] = useState(-1)
  const [bpm, setBpm] = useState(BPM.initial)
  const patternRef = useRef(pattern), mutedRef = useRef(muted)
  useEffect(() => { patternRef.current = pattern; mutedRef.current = muted }, [pattern, muted])
  const groove = useRef<Groove | null>(null)

  const engine = () => {
    groove.current ??= createGroove({ pattern: () => patternRef.current, isMuted: id => mutedRef.current.has(id), onStep: setStep }, bpm)
    return groove.current
  }
  useEffect(() => { groove.current?.setBpm(bpm) }, [bpm])
  useEffect(() => () => { if (groove.current?.playing()) groove.current.stop() }, [])

  const toggle = () => {
    const g = engine()
    if (g.playing()) { g.stop(); setPlaying(false) } else { g.start(); setPlaying(true) }
  }
  const tap = (id: InstId, s: number) => {
    const next = toggleCell(pattern, id, s)
    patternRef.current = next
    setPattern(next)
    groove.current?.hit(id, s)
  }
  const mute = (id: InstId) => setMuted(m => {
    const n = new Set(m)
    if (n.has(id)) n.delete(id); else n.add(id)
    mutedRef.current = n
    return n
  })
  const clave = detectClave(pattern)
  const now = playing ? step : -1
  const chord = now >= 0 ? antic(now) : 'C'

  return (
    <div className="seq">
      <div className="seq-top">
        <button className="seq-play" type="button" onClick={toggle} aria-pressed={playing}>
          <span className="pb" aria-hidden="true">
            {playing
              ? <svg width="11" height="11" viewBox="0 0 10 10"><rect x="1.5" y="1.5" width="7" height="7" rx="1" fill="currentColor" /></svg>
              : <svg width="12" height="12" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg>}
          </span>
          <span>{playing ? k('stop') : k('play')}</span>
        </button>
        <div className="seq-ctl">
          <div className="seg" role="group" aria-label={k('claveLabel')}>
            {CLAVE_BUTTONS.map(c => (
              <button key={c} type="button" aria-pressed={clave === c} onClick={() => { const n = withClave(pattern, c); patternRef.current = n; setPattern(n) }}>{k(`clave.${c}`)}</button>
            ))}
          </div>
          <div className="tempo" role="group" aria-label={k('tempo')}>
            <button type="button" aria-label={k('slower')} disabled={bpm <= BPM.min} onClick={() => setBpm(b => Math.max(BPM.min, b - BPM.step))}>−</button>
            <output className="tnum" aria-live="polite"><b>{bpm}</b> BPM</output>
            <button type="button" aria-label={k('faster')} disabled={bpm >= BPM.max} onClick={() => setBpm(b => Math.min(BPM.max, b + BPM.step))}>+</button>
          </div>
        </div>
      </div>
      <div className="seq-rows">
        {INST_IDS.map(id => {
          const name = k(`inst.${id}.name`), off = muted.has(id)
          return (
            <div key={id} className={`seq-row${off ? ' muted' : ''}`} style={{ ['--c' as string]: COLORS[id] }}>
              <button type="button" className="seq-lbl" aria-pressed={off} aria-label={k('mute', { name })} onClick={() => mute(id)}>
                <b><i />{name}</b><span>{k(`inst.${id}.part`)}</span>
              </button>
              <div className="cells">
                {Array.from({ length: 16 }, (_, s) => {
                  const v = vel(pattern, id, s)
                  return (
                    <button key={s} type="button" className={`${v ? 'on' : ''}${now === s ? ' now' : ''}`} style={{ ['--v' as string]: v }}
                      aria-pressed={!!v} aria-label={k('cell', { name, n: s + 1 })} onClick={() => tap(id, s)} />
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
      <div className="counts" aria-hidden="true"><span /><div>{Array.from({ length: 16 }, (_, s) => s % 2 ? <span key={s}>&amp;</span> : <b key={s}>{(s % 8) / 2 + 1}</b>)}</div></div>
      <div className="seq-foot">
        <small>{k('foot')}</small>
        <span className="chord serif" style={{ fontSize: 22 }}>{chord}</span>
      </div>
    </div>
  )
}
