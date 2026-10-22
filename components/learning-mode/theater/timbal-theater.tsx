'use client'
import { createContext, useContext, useEffect, useId, useRef, useState, type KeyboardEvent, type CSSProperties, type ReactNode } from 'react'
import { useLearningMode } from '../store'
import { useTheme } from '@/components/theme-provider'
import { useTranslation } from '@/components/language-provider'
import { timbalScene, timbalTheaterModule } from './timbal-scenes'
import { Timbalito, TimbalitoGuide } from '../timbalito'
import styles from './timbal-theater.module.css'
import { ClassroomLamps } from '../classroom-lamps'

export const TheaterClassContext = createContext('')
export function TheaterVideoSlot({children, workspace = false}: {children: ReactNode; workspace?: boolean}) {
  const classId = useContext(TheaterClassContext)
  if (workspace) return <>{children}</>
  return classId ? <TimbalTheater classId={classId}>{children}</TimbalTheater> : <>{children}</>
}
export function TimbalTheater({ classId, children, empty = false }: { classId: string; children: ReactNode; empty?: boolean }) {
  const mode = useLearningMode()
  const { theme, setTheme } = useTheme()
  const { locale } = useTranslation()
  const [motion, setMotion] = useState(true)
  const arrowId = useId().replace(/:/g, '')
  const roomRef = useRef<HTMLElement>(null)
  const [anchor, setAnchor] = useState({x: 0, y: 0, left: 0, top: 0})
  const [tip, setTip] = useState<string | null>(null)
  const [completedClass, setCompletedClass] = useState<string | null>(null)
  const completed = completedClass === classId
  useEffect(() => {
    if (!completed) return
    const dismiss = () => setCompletedClass(null)
    document.addEventListener('pointerdown', dismiss, true)
    document.addEventListener('keydown', dismiss, true)
    return () => {
      document.removeEventListener('pointerdown', dismiss, true)
      document.removeEventListener('keydown', dismiss, true)
    }
  }, [completed])
  const scene = timbalScene(classId)
  if (mode !== 'kids' || !scene) return <>{children}</>
  const es = locale === 'es'
  const tips: Record<string, [string, string, string, string]> = {
    clock: ['Reloj', 'Clock', '¡Un poquito cada día! Practica de 15 a 30 minutos diarios para acercarte a tocar como un máster de la música latina.', 'A little every day! Practise for 15 to 30 minutes daily to work towards playing like a Latin music master.'],
    poster: ['Solfeo', 'Music reading', '¡Do, re, mi! Recuerda que tu suscripción incluye un curso de solfeo para aprender a leer música. Cada nota abre una nueva aventura.', 'Do, re, mi! Remember, your subscription includes a music-reading course. Every note opens a new adventure.'],
    harp: ['Arpa', 'Harp', '¡Escucha las cuerdas del arpa! Algunas suenan graves y otras agudas. Al escuchar al maestro, intenta reconocer también los sonidos graves y agudos del timbal.', 'Listen to the harp strings! Some sound low and others high. When you listen to the teacher, try to recognise the low and high sounds of the timbales too.'],
    trumpet: ['Trompeta', 'Trumpet', '¡La trompeta tiene mucho que contar! También tenemos un curso de trompeta. Descubre cómo la respiración se convierte en música.', 'The trumpet has so much to say! We also have a trumpet course. Discover how breathing becomes music.'],
    drums: ['Batería', 'Drums', '¡Siente el pulso! También tenemos un curso de batería. Escucha, coordina tus manos y descubre nuevos ritmos paso a paso.', 'Feel the beat! We also have a drum course. Listen, coordinate your hands and discover new rhythms step by step.'],
    window: ['Ventana', 'Window', '¡Mira hacia tu futuro! Con práctica, paciencia y curiosidad puedes avanzar hacia tu sueño de ser un profesional del timbal. ¡Hoy damos otro paso!', 'Look towards your future! With practice, patience and curiosity, you can move towards your dream of becoming a professional timbales player. Let’s take another step today!'],
    xylophone: ['Xilófono', 'Xylophone', '¡Cada color tiene su voz! Escucha una melodía y canta su ritmo antes de tocarlo. Primero escucha, después imita y luego crea.', 'Every colour has a voice! Listen to a melody and sing its rhythm before playing it. First listen, then imitate, then create.'],
  }
  const showTip = (key: string, target: Element) => {
    const room = roomRef.current?.getBoundingClientRect()
    if (!room) return
    const rect = target.getBoundingClientRect()
    const x = (rect.left + rect.width / 2 - room.left) / (room.width || 1) * roomRef.current!.clientWidth
    const y = (rect.top + rect.height / 2 - room.top) / (room.height || 1) * roomRef.current!.clientHeight
    const width = Math.min(300, roomRef.current!.clientWidth - 24)
    setAnchor({x, y, left: Math.max(12, Math.min(x - width / 2, roomRef.current!.clientWidth - width - 12)), top: y > roomRef.current!.clientHeight - 240 ? Math.max(12, y - 220) : y + 32})
    setTip(key)
  }
  const hotspot = (key: string) => ({
    role: 'button' as const, tabIndex: 0, className: styles.hotspot,
    'aria-label': tips[key][es ? 0 : 1], 'aria-expanded': tip === key,
    onClick: (event: {currentTarget: Element}) => showTip(key, event.currentTarget),
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); showTip(key, event.currentTarget) }
    },
  })
  return <section data-timbal-classroom ref={roomRef} onKeyDown={event => { if (event.key === 'Escape') setTip(null) }} onEndedCapture={event => {
    if (event.target instanceof HTMLVideoElement && event.target.closest('[data-lesson-video]') && !event.target.closest('[data-exercise-watch]')) {
      setTip(null); setCompletedClass(classId)
    }
  }} onPlayCapture={() => { setTip(null); setCompletedClass(null) }} onSeekingCapture={event => { setTip(null); setCompletedClass(null) }} className={styles.theater} data-son={timbalTheaterModule(classId) === 3} data-day={theme === 'light'} data-motion={motion} style={{ '--scene': scene[6] } as CSSProperties} aria-label={es ? 'Aula musical infantil' : 'Children’s music classroom'}>
    <ClassroomLamps/>
    <div className={styles.ceiling} aria-hidden="true"><i/><i/><i/></div>
    <header className={styles.header}>
      <div><span className={styles.kicker}>{es ? `MÓDULO ${timbalTheaterModule(classId)} · MI AULA MUSICAL` : `MODULE ${timbalTheaterModule(classId)} · MY MUSIC CLASSROOM`}</span><h2>{scene[es ? 1 : 2]}</h2><p>{scene[es ? 3 : 4]}</p></div>
      <div className={styles.settings} role="group" aria-label={es ? 'Ambiente del aula' : 'Classroom setting'}>
        <button type="button" aria-pressed={theme === 'light'} onClick={() => setTheme('light')}>☀ {es ? 'Día' : 'Day'}</button>
        <button type="button" aria-pressed={theme === 'dark'} onClick={() => setTheme('dark')}>☾ {es ? 'Noche' : 'Night'}</button>
        <button type="button" aria-pressed={!motion} onClick={() => setMotion(!motion)}>{motion ? 'Ⅱ' : '▷'} {es ? 'Animaciones' : 'Animations'}</button>
      </div>
    </header>
    <div className={styles.auditorium}>
      <aside className={styles.leftWall}>
        <div {...hotspot('clock')} className={`${styles.clock} ${styles.hotspot}`}><span>12</span><i/><b/></div>
        <div {...hotspot('poster')} className={`${styles.poster} ${styles.hotspot}`}><span>♫</span><small>DO · RE · MI</small><svg className={styles.posterStaff} viewBox="0 0 140 65" aria-hidden="true">
          {[18,26,34,42,50].map(y=><path key={y} d={`M5 ${y}H135`} stroke="#537b70" strokeWidth="1"/>)}
          <path d="M47 58H67" stroke="#537b70" strokeWidth="1"/><text x="7" y="51" fontSize="48" fill="#3d716b">𝄞</text>
          {[{x:57,y:58},{x:85,y:54},{x:113,y:50}].map(({x,y})=><g key={x} fill="#b06b56" stroke="#b06b56"><ellipse cx={x} cy={y} rx="6" ry="4" transform={`rotate(-18 ${x} ${y})`}/><path d={`M${x+5} ${y}V${y-25}`} strokeWidth="2"/></g>)}
        </svg></div>
        <svg className={styles.instruments} viewBox="0 0 230 210">
          <g {...hotspot('harp')} transform="translate(-10 7)" stroke="#87612e" strokeWidth="3" strokeLinejoin="round"><rect x="10" y="15" width="125" height="190" fill="transparent" stroke="none" pointerEvents="all"/><path d="M25 195L43 38Q90 15 130 60L63 190Z" fill="#e9b857"/><path d="M45 60q43-20 67 6L60 174Z" fill="#d2e7d7"/>{[0,1,2,3,4,5].map(i=><path key={i} d={`M${48+i*10} ${54+i*2}L${57+i*2} ${167-i*14}`} stroke="#fff3ba" strokeWidth="2"/>)}<path d="M20 195h56" strokeWidth="8" strokeLinecap="round"/></g>
          <g {...hotspot('trumpet')} transform="translate(120 25) rotate(-12)" fill="#edbc4c" stroke="#996d26" strokeWidth="2"><rect x="0" y="12" width="100" height="66" fill="transparent" stroke="none" pointerEvents="all"/><path d="M5 35h60l27-18v51L65 50H5Z"/><path d="M15 49v23h35V50" fill="none" strokeWidth="7"/>{[22,35,48].map(x=><path key={x} d={`M${x} 23v15m-4-15h8`} fill="none" strokeWidth="4"/>)}</g>
          <g {...hotspot('xylophone')} transform="translate(120 132) rotate(8)"><rect x="-3" y="-3" width="98" height="75" fill="transparent" pointerEvents="all"/><path d="M0 8h90v48H0Z" fill="#926945"/>{['#d96d77','#efa35c','#e6cc62','#81b385','#69b6c1','#7b91c1','#ad8bc1'].map((c,i)=><rect key={c} x={i*12+3} y={i*2+2} width="10" height={43-i*3} rx="2" fill={c} stroke="#674e3d" strokeWidth="1"/>)}<path d="M5 65L75 45M25 68L80 15" stroke="#76573d" strokeWidth="3"/><circle cx="75" cy="45" r="5" fill="#eee5c2"/><circle cx="80" cy="15" r="5" fill="#eee5c2"/></g>
        </svg>
      </aside>
      <aside className={styles.rightWall}>
        <div {...hotspot('window')} className={`${styles.window} ${styles.hotspot}`}><div className={styles.skyOrb}/><div className={styles.cloud}/><div className={styles.hills}/><i/><b/></div>
        <div className={styles.mascot} style={{visibility: completed ? 'hidden' : undefined}}><TimbalitoGuide paused={!motion}/></div>
        <div className={styles.plant}><i/><i/><i/><b/></div>
        <svg {...hotspot('drums')} className={`${styles.instruments} ${styles.percussion} ${styles.hotspot}`} viewBox="0 0 230 160">
          <rect width="230" height="160" fill="transparent" pointerEvents="all"/>
          <g stroke="#7b6757" strokeWidth="3" fill="none"><path d="M30 35v113M30 130l-18 20m18-20 18 20M196 25v120m0-18-19 20m19-20 20 20"/></g>
          <ellipse cx="32" cy="35" rx="28" ry="6" fill="#e6bd61" stroke="#977b39" strokeWidth="2"/><ellipse cx="195" cy="24" rx="32" ry="6" fill="#e6bd61" stroke="#977b39" strokeWidth="2"/>
          <path d="M52 45v43q23 14 45 0V45M129 42v43q25 14 48 0V42" fill="#cf7863" stroke="#755847" strokeWidth="3"/><ellipse cx="75" cy="45" rx="23" ry="9" fill="#fff1cd" stroke="#aa8e65" strokeWidth="3"/><ellipse cx="153" cy="42" rx="25" ry="9" fill="#fff1cd" stroke="#aa8e65" strokeWidth="3"/>
          <circle cx="113" cy="110" r="40" fill="#76a6b2" stroke="#d7bc87" strokeWidth="7"/><circle cx="113" cy="110" r="29" fill="#ecdfbd" stroke="#537887" strokeWidth="2"/><path d="M105 112v-17l16-3v17" stroke="#6e8a83" strokeWidth="3" fill="none"/><ellipse cx="101" cy="114" rx="5" ry="3" fill="#6e8a83"/><ellipse cx="117" cy="111" rx="5" ry="3" fill="#6e8a83"/>
        </svg>
      </aside>
    <div className={styles.stage}>
      <div className={styles.screen} data-kids-score-workspace>{empty ? <div className={styles.waiting}>
        <span className={styles.world} aria-hidden="true">{scene[5]}</span>
        <svg viewBox="0 0 400 210" role="img" aria-label={es ? 'Timbales en nuestro escenario' : 'Timbales on our stage'}>
          <ellipse cx="200" cy="192" rx="135" ry="12" fill="currentColor" opacity=".1"/>
          <path d="M200 90V175M200 160L145 194M200 160L255 194" fill="none" stroke="#b9c4d0" strokeWidth="9" strokeLinecap="round"/>
          <path d="M82 62V120Q135 153 188 120V62M212 62V115Q260 143 308 115V62" fill="#8ca5b7" stroke="#e7edf0" strokeWidth="4"/>
          <ellipse cx="135" cy="62" rx="54" ry="22" fill="#fff1c5" stroke="#ffbd4c" strokeWidth="7"/>
          <ellipse cx="260" cy="62" rx="49" ry="21" fill="#fff1c5" stroke="#ffbd4c" strokeWidth="7"/>
          <path d="M96 87V119M175 87V119M226 87V115M294 87V115" stroke="#e7edf0" strokeWidth="5"/>
          <path d="M155 18L213 52M244 15L201 49" stroke="#e4aa68" strokeWidth="7" strokeLinecap="round"/>
        </svg>
        <strong>{scene[es ? 1 : 2]}</strong><p>{es ? 'El escenario está listo para el video de esta clase.' : 'The stage is ready for this class video.'}</p>
      </div> : children}</div>
      <div className={styles.chalkTray} aria-hidden="true"><i/><i/><b/></div>
    </div>
    </div>
    <div className={styles.audience} aria-hidden="true">
      {[0,1].map(row=><div className={styles.deskRow} data-row={row} key={row}>
        {[0,1,2,3,4].map(i=><svg className={styles.student} key={i} viewBox="0 0 180 155" style={{'--delay':`${i*-.8-row}s`,'--shirt':['#77b6ca','#e9ad64','#a695cc','#80b6a0','#d5828d'][(i+row)%5],'--hair':['#513c35','#8b5636','#342f38','#bf8545','#603e32'][(i+row)%5],'--skin':['#e6b48c','#b97c56','#e3a47f','#975f43','#d8a477'][(i+row)%5]} as CSSProperties}>
          <path d="M23 83L19 145M154 83l8 62" stroke="#577980" strokeWidth="6"/>
          <path d="M22 57h132l22 36H4Z" fill="#e8b979" stroke="#927052" strokeWidth="2"/><path d="M4 93h172v8H4Z" fill="#bc8457"/>
          <path d="M23 65l31-3 13 20-31 3Z" fill="#fff9e4" stroke="#9cae9b"/><path d="M39 68l18 12M32 73l22 0M35 77h22" stroke="#a8b9b0"/>
          <path d="M130 67l21 15" stroke="#e47262" strokeWidth="3"/>
          <g className={styles.pupil}>
            <path d="M70 69Q51 65 46 80M112 70q16-7 25 10" stroke="var(--skin)" strokeWidth="12" strokeLinecap="round"/>
            <path d="M65 65Q90 53 115 65l10 48H54Z" fill="var(--shirt)" stroke="#344754" strokeWidth="1.5"/>
            <path d="M84 52v13q7 8 14 0V52" fill="var(--skin)"/>
            <ellipse cx="72" cy="38" rx="5" ry="7" fill="var(--skin)"/><ellipse cx="111" cy="38" rx="5" ry="7" fill="var(--skin)"/>
            <path d="M71 39Q63 4 91 5q29 0 22 34l-5 14q-16 12-31 0Z" fill="var(--hair)" stroke="#443832" strokeWidth="1.5"/>
            {i%2===1&&<path d="M74 32Q51 39 62 65q12 11 18-5l-1-22" fill="var(--hair)" stroke="#443832" strokeWidth="1.5"/>}
            <path d="M78 16q11-8 23 0" fill="none" stroke="#ffffff" opacity=".14" strokeWidth="3" strokeLinecap="round"/>
          </g>
          <path d="M57 103q33-13 66 0l-3 35H60Z" fill="#416b7d" stroke="#274858" strokeWidth="3"/><path d="M63 137l-2 17M117 137l3 17" stroke="#53717a" strokeWidth="5"/>
        </svg>)}
      </div>)}
    </div>
    {tip && <>
      <svg className={styles.tipArrow} aria-hidden="true"><defs><marker id={arrowId} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M1 1L6 4L1 7" fill="none" stroke="#f58210" strokeWidth="1.5"/></marker></defs><path d={`M${anchor.left + Math.min(150, (roomRef.current?.clientWidth ?? 324) / 2 - 12)} ${anchor.top + (anchor.top < anchor.y ? 110 : 0)} L${anchor.x} ${anchor.y}`} fill="none" stroke="#f58210" strokeWidth="3" markerEnd={`url(#${arrowId})`}/></svg>
      <div className={styles.tipCard} role="status" style={{left: anchor.left, top: anchor.top}}>
        <div><strong>{tips[tip][es ? 0 : 1]}</strong><p>{tips[tip][es ? 2 : 3]}</p></div>
        <button type="button" onClick={() => setTip(null)} aria-label={es ? 'Cerrar consejo' : 'Close tip'}>×</button>
      </div>
    </>}
    {completed && <div className={styles.completion} role="status">
      <Timbalito paused={!motion}/><div><strong>{es ? '¡Un paso más en tu aventura musical!' : 'Another step in your musical adventure!'}</strong>
      <p>{es ? '¡Has llegado al final de esta clase! Cuando estés listo, pulsa Siguiente para descubrir qué viene ahora. ¡Te acompaño!' : 'You’ve reached the end of this lesson! When you’re ready, press Next to discover what comes next. I’m coming with you!'}</p>
      <small>{es ? 'Toca cualquier parte para que vuelva a mi lugar.' : 'Tap anywhere and I’ll return to my spot.'}</small></div>
    </div>}
    <p className={styles.caption}>{es ? '¡Tu aula está lista para descubrir la música!' : 'Your classroom is ready to discover music!'}</p>
  </section>
}
