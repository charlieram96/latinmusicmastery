'use client'
import { useAdventureTheme } from './adventure-theme'
import s from './first-garden.module.css'
/** Decorative silhouettes stay outside the central reading/answer area. */
export function HabitatScenery(){
 const {id}=useAdventureTheme()
 if(id==='ocean'||id==='detective')return <svg className={s.habitatDrawing} viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true"><path d="M0 474Q150 445 300 480T650 475T1000 470V500H0Z" fill="#cfdfbc"/>{[20,52,80,920,950,978].map((x,i)=><path key={x} d={`M${x} 500q-28 -40 0 -75t0 -70`} stroke={i%2?'#5ba998':'#75ba8c'} strokeWidth="13" fill="none" strokeLinecap="round"/>)}<path d="M100 500v-55m0 30-23-20m23 5 23-25M884 500v-50m0 28-17-20m17 10 17-30" stroke="#df9cae" strokeWidth="10" fill="none" strokeLinecap="round"/></svg>
 if(id==='space')return <svg className={s.habitatDrawing} viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true"><g stroke="#8f8bce" strokeWidth="2" fill="#fff4b0"><path d="M30 85L68 42L112 66L84 114L30 85M845 65L895 40L940 90L978 53" fill="none" strokeDasharray="4 6"/>{[[30,85],[68,42],[112,66],[84,114],[845,65],[895,40],[940,90],[978,53]].map(([x,y])=><circle key={x} cx={x} cy={y} r="5"/>)}<ellipse cx="925" cy="420" rx="48" ry="13" transform="rotate(-25 925 420)" fill="none" stroke="#b48cc9" strokeWidth="7"/><circle cx="925" cy="420" r="28" fill="#c8a8d6"/></g></svg>
 if(id==='sky')return <svg className={s.habitatDrawing} viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true"><path d="M0 500V400L80 280L210 500M780 500L925 280L1000 400V500" fill="#9dbbc8"/><path d="M48 328L80 280L130 364L91 346L78 354L64 329M880 350L925 280L960 336L938 331L923 350L904 335" fill="#fff"/></svg>
 if(id==='forest'||id==='prehistoric')return <svg className={s.habitatDrawing} viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true">{[30,85,920,980].map((x,i)=><g key={x}><path d={`M${x} 500v-120`} stroke="#a89270" strokeWidth="13"/><ellipse cx={x} cy={350+i%2*35} rx="45" ry="66" fill={i%2?'#95bc7a':'#75ac8c'}/></g>)}</svg>
 if(id==='island')return <svg className={s.habitatDrawing} viewBox="0 0 1000 500" preserveAspectRatio="none" aria-hidden="true"><path d="M0 465Q130 425 260 465T520 465T780 465T1040 465V500H0" fill="#89cdd6"/><path d="M0 480Q150 450 300 480T600 480T900 480" stroke="#e8fbff" strokeWidth="5" fill="none"/></svg>
 return null
}
