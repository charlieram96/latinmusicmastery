'use client'

import { useTheme } from '@/components/theme-provider'
import { useLearningMode } from './store'
import styles from './classroom-lamps.module.css'

/** The same pair follows the shared day/night setting in classroom and module covers. */
export function ClassroomLamps({ cover = false }: { cover?: boolean }) {
  const { theme } = useTheme()
  const mode = useLearningMode()
  if (mode !== 'kids') return null
  return <div className={styles.pair} data-cover={cover} data-lit={theme === 'dark'} aria-hidden="true">
    {['left', 'right'].map(side => <div key={side} className={styles.lamp} data-side={side}>
      <div className={styles.glow}/>
      <svg viewBox="0 0 70 100">
        <ellipse cx="35" cy="80" rx="13" ry="16" fill="#956e4e" stroke="#664a36" strokeWidth="2"/>
        <path d="M35 80V60" stroke="#d0a46a" strokeWidth="7" strokeLinecap="round"/>
        <path d="M17 48H53L47 62H23Z" fill="#cb9959" stroke="#765134" strokeWidth="2"/>
        <path className={styles.bulb} d="M24 39a14 14 0 1 1 22 0l-4 10H28Z"/>
        <path d="M30 46l-3-14 8 5 8-5-3 14" fill="none" stroke="#c48b35" strokeWidth="2"/>
        <path d="M21 9H49L62 31Q35 22 8 31Z" fill="#e5b871" stroke="#93663e" strokeWidth="2"/>
        <path d="M25 11H45" stroke="#fff0c6" strokeWidth="3" strokeLinecap="round"/>
        <g className={styles.rays} stroke="#ffdf7f" strokeWidth="2.5" strokeLinecap="round"><path d="M9 42H2M61 42H68M13 56L7 62M57 56L63 62M35 2V0"/></g>
      </svg>
    </div>)}
  </div>
}
