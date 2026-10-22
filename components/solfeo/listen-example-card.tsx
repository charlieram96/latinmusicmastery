'use client'
import {useBookTranslation} from './use-book-translation'
import {Crosshair,Square} from 'lucide-react'
import styles from './listen-example-card.module.css'
export function ListenExampleCard({playing,onClick,title='Escuchar ejemplo',detail}:{playing:boolean;onClick:()=>void;title?:string;detail:string}){
 const {t,es}=useBookTranslation()
 return <button type="button" className={styles.card} aria-pressed={playing} onClick={onClick}>
  <span className={styles.icon} aria-hidden="true">{playing?<Square size={20}/>:<Crosshair size={24}/>}</span>
  <span className={styles.copy}><span className={styles.eyebrow}>{es?'ESCUCHA · COMPRENDE':'LISTEN · UNDERSTAND'}</span><strong>{playing?(es?'Detener':'Stop'):t(title)}</strong><span className={styles.detail}>{detail}</span></span>
 </button>
}
