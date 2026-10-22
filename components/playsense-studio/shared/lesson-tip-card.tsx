import type { CSSProperties, ReactNode } from 'react'
import styles from '../studio/video-effects-preview.module.css'

/** The same brief coaching card in video overlays and theory screens. */
export function LessonTipCard({icon, label, title, detail, inline = false, style}: {
  icon: ReactNode; label: string; title: string; detail: string; inline?: boolean; style?: CSSProperties
}) {
  return <div className={styles.tip} style={{...(inline ? {position:'relative',left:'auto',bottom:'auto',maxWidth:'100%',width:'fit-content'} as CSSProperties : {}),...style}}>
    <span className={styles.tipIcon}>{icon}</span>
    <div><p className={styles.eyebrow}>{label}</p><h3>{title}</h3><p className={styles.detail}>{detail}</p></div>
  </div>
}
