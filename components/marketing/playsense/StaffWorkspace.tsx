'use client'

import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from '@/components/language-provider'
import { useInViewVideo } from '@/components/marketing/site/useInViewVideo'
import {
  BPM, CHORDS, COUNTS, NOTE_STEPS, ONSETS, STEPS, judge, loopOf, playheadStep, stepX, type Anchor,
} from '@/lib/marketing/staff-demo'

type Layout = 'side' | 'stack' | 'music'
const LAYOUTS: Layout[] = ['side', 'stack', 'music']

interface Built {
  anchors: Anchor[]
  notes: Element[]
  bars: [number, number][]
}

/**
 * Lesson video + a two-bar son bass tumbao engraved with VexFlow (the same
 * `vexflow` build the app's notation uses, which bundles Bravura). A playhead
 * walks the bars with chord symbols, counts, a bar tint, played-note dimming
 * and simulated judgments. Port of the prototype's mountWS/buildStaff/tickWS
 * (staff view).
 */
export function StaffWorkspace() {
  const { t } = useTranslation()
  const k = (s: string, p?: Record<string, string | number>) => t(`marketing.site.playsense.${s}`, p)
  const [layout, setLayout] = useState<Layout>('side')
  const [res, setRes] = useState({ ok: 0, late: 0, loop: 1 })
  const [failed, setFailed] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const music = useRef<HTMLDivElement>(null)
  const staff = useRef<HTMLDivElement>(null)
  const host = useRef<HTMLDivElement>(null)
  const ph = useRef<HTMLDivElement>(null)
  const tint = useRef<HTMLDivElement>(null)
  const chords = useRef<HTMLDivElement>(null)
  const helpers = useRef<HTMLDivElement>(null)
  const judges = useRef<HTMLDivElement>(null)
  const scrub = useRef<HTMLElement>(null)
  const time = useRef<HTMLSpanElement>(null)
  const video = useRef<HTMLVideoElement>(null)
  const words = useRef({ perfect: '', late: '' })
  useInViewVideo(video, 0.15)
  useEffect(() => { words.current = { perfect: k('ws.perfect'), late: k('ws.lateMs', { ms: '{ms}' }) } })

  useEffect(() => {
    const el = root.current, box = music.current, hostEl = host.current
    if (!el || !box || !hostEl) return
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
    let disposed = false, built: Built | null = null, width = 0, visible = false, raf = 0
    let VF: typeof import('vexflow') | null = null

    const build = () => {
      if (!VF) return
      const W = hostEl.clientWidth
      if (!W) return
      width = W
      hostEl.innerHTML = ''
      const { Renderer, Stave, StaveNote, Formatter, StaveTie, BarlineType } = VF
      const H = 120, sc = W < 520 ? 0.8 : 1, w = W / sc
      const r = new Renderer(hostEl, Renderer.Backends.SVG)
      r.resize(W, H * sc)
      const ctx = r.getContext()
      ctx.scale(sc, sc)
      ctx.setFillStyle('#F6EBDD'); ctx.setStrokeStyle('rgba(246,235,221,.55)')
      const w1 = (w - 12) * 0.54, w2 = (w - 12) - w1
      const s1 = new Stave(4, 6, w1); s1.addClef('bass').addTimeSignature('4/4'); s1.setBegBarType(BarlineType.REPEAT_BEGIN)
      const s2 = new Stave(4 + w1, 6, w2); s2.setEndBarType(BarlineType.REPEAT_END)
      for (const s of [s1, s2]) s.setContext(ctx).draw()
      const style = { fillStyle: '#F6EBDD', strokeStyle: '#F6EBDD' }
      const N = (key: string, d: string) => { const n = new StaveNote({ clef: 'bass', keys: [key], duration: d }); n.setStyle(style); return n }
      const b1 = [N('d/3', 'qr'), N('d/3', '8r'), N('f/2', '8'), N('f/2', 'q'), N('g/2', 'q')]
      const b2 = [N('g/2', 'q'), N('d/3', '8r'), N('f/2', '8'), N('f/2', 'q'), N('c/3', 'q')]
      Formatter.FormatAndDraw(ctx, s1, b1); Formatter.FormatAndDraw(ctx, s2, b2)
      const tie = (a: InstanceType<typeof StaveNote>, b: InstanceType<typeof StaveNote> | null) =>
        new StaveTie({ firstNote: a, lastNote: b, firstIndexes: [0], lastIndexes: [0] }).setContext(ctx).draw()
      tie(b1[2], b1[3]); tie(b1[4], b2[0]); tie(b2[2], b2[3]); tie(b2[4], null)
      const all = [...b1, ...b2]
      const anchors: Anchor[] = all.map((n, i) => [NOTE_STEPS[i], (n.getAbsoluteX() + 6) * sc])
      anchors.push([STEPS, (s2.getX() + s2.getWidth() - 12) * sc])
      const svg = hostEl.querySelector('svg')
      svg?.setAttribute('role', 'img'); svg?.setAttribute('aria-label', k('ws.staffLabel'))
      built = {
        anchors,
        notes: [...hostEl.querySelectorAll('.vf-stavenote')],
        bars: [[s1.getNoteStartX() * sc - 6, (s1.getX() + s1.getWidth()) * sc], [s2.getX() * sc + 2, (s2.getX() + s2.getWidth()) * sc - 2]],
      }
      if (ph.current) ph.current.style.height = `${H * sc - 26}px`
      const X = (s: number) => stepX(anchors, s)
      if (chords.current) chords.current.innerHTML = CHORDS.map((c, i) => `<span style="left:${X(i * 4)}px">${c}</span>`).join('')
      if (helpers.current) helpers.current.innerHTML = COUNTS.map((c, s) => `<span style="left:${X(s) + 2}px">${sc < 1 && c === '&' ? '' : c}</span>`).join('')
    }

    const t0 = performance.now() / 1000
    let lastP = 0, loops = 0, jk = 0
    const tick = (ms: number) => {
      raf = requestAnimationFrame(tick)
      if (!visible || !built || !el.offsetParent) return
      const now = ms / 1000
      const p = reduce ? 5.5 : playheadStep(now - t0, BPM)
      const loop = reduce ? 0 : loopOf(now - t0, BPM)
      if (loop !== loops) {
        loops = loop
        built.notes.forEach(n => n.classList.remove('played', 'lit-ok', 'lit-late'))
        setRes(r => ({ ...r, loop: loop + 1 }))
      }
      for (const s of ONSETS) {
        if (!(lastP < s && p >= s)) continue
        const j = judge(jk++)
        setRes(r => ({ ...r, ok: r.ok + (j.ok ? 1 : 0), late: r.late + (j.ok ? 0 : 1) }))
        built.notes[NOTE_STEPS.indexOf(s)]?.classList.add(j.ok ? 'lit-ok' : 'lit-late')
        if (judges.current) {
          const tag = document.createElement('span')
          tag.className = `judge ${j.ok ? 'ok' : 'late'}`
          tag.textContent = j.ok ? (j.perfect ? words.current.perfect : `${j.offset > 0 ? '+' : ''}${j.offset}ms`) : words.current.late.replace('{ms}', String(j.offset))
          tag.style.left = `${stepX(built.anchors, s) + 18}px`
          judges.current.appendChild(tag)
          window.setTimeout(() => tag.remove(), 1000)
        }
      }
      lastP = p
      if (ph.current) ph.current.style.transform = `translateX(${stepX(built.anchors, p) + 15}px)`
      built.notes.forEach((n, i) => { if (NOTE_STEPS[i] + 1.5 < p) n.classList.add('played') })
      const b = p < 8 ? built.bars[0] : built.bars[1]
      if (tint.current) { tint.current.style.left = `${b[0] + 16}px`; tint.current.style.width = `${b[1] - b[0]}px` }
      const ci = Math.floor(p / 4), cs = Math.floor(p)
      chords.current?.querySelectorAll('span').forEach((x, i) => x.classList.toggle('cur', i === ci))
      helpers.current?.querySelectorAll('span').forEach((x, i) => x.classList.toggle('cur', i === cs))
      scrub.current?.style.setProperty('--p', `${(38 + 14 * (p / STEPS)).toFixed(1)}%`)
      if (time.current) { const secs = Math.floor(370 * (0.38 + 0.14 * p / STEPS)); time.current.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}` }
    }

    const ro = new ResizeObserver(() => { if (Math.abs(hostEl.clientWidth - width) > 8) build() })
    const io = new IntersectionObserver(es => { visible = es[es.length - 1].isIntersecting })
    ;(async () => {
      try {
        VF = await import('vexflow')
        try { await Promise.race([document.fonts.load('30px Bravura'), new Promise(r => setTimeout(r, 1500))]) } catch { /* draw with whatever loaded */ }
        if (disposed) return
        build()
        ro.observe(box); io.observe(el)
        raf = requestAnimationFrame(tick)
      } catch {
        if (!disposed) setFailed(true)
      }
    })()
    return () => { disposed = true; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect() }
    // Built once; the words ref carries language changes into the judgments.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const choose = (next: Layout) => {
    const apply = () => flushSync(() => setLayout(next))
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown }
    if (doc.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) doc.startViewTransition(apply)
    else apply()
  }

  return (
    <>
      <div className="ws-tools">
        <div className="seg" role="group" aria-label={k('chart.layout')}>
          {LAYOUTS.map(l => <button key={l} type="button" aria-pressed={layout === l} onClick={() => choose(l)}>{k(`chart.${l}`)}</button>)}
        </div>
      </div>
      <div ref={root} className="ws" data-layout={layout}>
        <div className="app-bar">
          <span className="dots" aria-hidden="true"><i /><i /><i /></span>
          <span className="app-title"><b>{k('ws.course')}</b> · {k('ws.lesson')}</span>
          <span className="sp" />
          <span className="pill tnum">{BPM} BPM · 65%</span>
          <span className="pill rec"><i />{k('ws.mic')}</span>
        </div>
        <div className="ws-body">
          <div className="ws-video">
            <video ref={video} muted loop playsInline preload="metadata" aria-hidden="true" onError={e => { e.currentTarget.style.display = 'none' }}>
              <source src="/videos/hero-video-final.mp4" type="video/mp4" />
            </video>
            <span className="vcap">{k('ws.videoCaption')}</span>
          </div>
          <div ref={music} className="ws-music">
            <div ref={staff} className="staff2">
              <div ref={chords} className="chords" aria-hidden="true" />
              <div ref={tint} className="bar-tint" aria-hidden="true" />
              <div ref={host} className="staff-host">{failed && <p className="staff-fallback">{k('ws.loadError')}</p>}</div>
              <div ref={ph} className="ph-line" aria-hidden="true" />
              <div ref={helpers} className="helpers" aria-hidden="true" />
              <div ref={judges} className="judges" aria-hidden="true" />
            </div>
          </div>
        </div>
        <div className="vbar" aria-hidden="true">
          <span><svg width="12" height="12" viewBox="0 0 10 10"><path d="M2 1l7 4-7 4z" fill="currentColor" /></svg></span>
          <span className="tnum" ref={time}>2:20</span>
          <span className="scrub"><i ref={scrub} /><span className="ab" /></span>
          <span className="tnum">6:10</span><span>0.65×</span><span>A–B ⟲</span>
        </div>
        <div className="ws-foot">
          <div className="res">
            <span className="ok">{k('ws.onTime')} <b className="tnum">{res.ok}</b></span>
            <span className="late">{k('ws.late')} <b className="tnum">{res.late}</b></span>
            <span>{k('ws.loop')} <b className="tnum">{res.loop}</b></span>
          </div>
          <span>{k('ws.simulated')}</span>
        </div>
      </div>
    </>
  )
}
