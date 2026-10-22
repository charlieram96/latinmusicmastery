'use client'

import { Play } from 'lucide-react'
import styles from '../studio/video-effects-preview.module.css'

/** Shared opening card for instrumental and theory lessons. Colors follow the platform theme. */
export function LessonStartCard({ title, label, detail, pills, action, onStart, instructor, inFlow = false, showAction = true }: {
  title: string; label: string; detail: string; pills: string[]; action: string; onStart: () => void; instructor?: string; inFlow?: boolean; showAction?: boolean
}) {
  return <div data-lesson-start className={styles.scrim} style={inFlow ? {position: 'relative', minHeight: 'inherit', paddingBottom: 70} : undefined}>
    <div className={styles.intro}>
      <p className={styles.eyebrow}>LATIN MUSIC MASTERY</p>
      <h2>{title}</h2>
      <p className={styles.readyLabel}>{label}</p>
      {instructor && <p>Instructor · {instructor}</p>}
      <p>{detail}</p>
      <div className={styles.pills}>{pills.map(pill=><span key={pill}>{pill}</span>)}</div>
      {showAction && <button type="button" className={styles.primary} onClick={onStart}><Play size={18} fill="currentColor"/>{action}</button>}
    </div>
  </div>
}
