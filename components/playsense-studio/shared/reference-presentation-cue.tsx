import { SonOrienteLayer } from './son-oriente-layer'
import { SonInfluenceLayer } from './son-influence-layer'
import { useId } from 'react'
import { presentationProgress, type PresentationCue } from '@/lib/playsense-studio/lesson-presentation'

/** Transparent vector layers measured against the 1280 × 720 reference frame.
 * Copy and timings stay in the authored profile so other lessons reuse this design.
 * All motion follows media time, including pause, replay and scrubbing backwards.
 */
export function ReferencePresentationCue({ cue, lang, time, reduced }: {
  cue: PresentationCue; lang: 'es' | 'en'; time: number; reduced: boolean
}) {
  const gradient = useId().replaceAll(':', '')
  const progress = (start: number, duration = .5) => reduced ? Number(time >= start) : presentationProgress(time, start, duration)
  if (cue.kind === 'son-influence') return <SonInfluenceLayer lang={lang} time={time} />
  if (cue.kind === 'son-oriente') return <SonOrienteLayer lang={lang} />
  const years = ['1900', '1910', '1920', '', '1940', '1950', '1960']
  return <svg className="lmm-reference-layer" viewBox="0 0 1280 720" role="img" aria-label={cue.title[lang]}>
    {cue.kind === 'instructor' || cue.kind === 'title' ? <g>
      {!cue.plain && <rect x="0" y="580" width="1280" height="114" fill="#000" fillOpacity=".58" />}
      <text x="128" y="638" className="lmm-reference-heading" fill="#df4934">
        {cue.kind === 'instructor' && cue.nameParts ? <>
          <tspan>{cue.nameParts[0]} </tspan><tspan fill="#f4f3ef">{cue.nameParts[1]} </tspan><tspan>{cue.nameParts[2]}</tspan>
        </> : cue.title[lang]}
      </text>
      <text x={cue.kind === 'instructor' ? 132 : 140} y="675" fill="#f4f3ef" fontSize="26" fontWeight={cue.kind === 'title' ? 700 : 600}>{cue.label[lang]}</text>
    </g> : cue.kind === 'timeline' ? <g>
      <defs><linearGradient id={gradient}><stop offset="0" stopColor="#ef2c15" /><stop offset=".48" stopColor="#ee3016" /><stop offset=".5" stopColor="#f5b900" /><stop offset="1" stopColor="#f6ca08" /></linearGradient></defs>
      <path d="M 430 527 H 852 V 601 H 406 V 551 Q 406 527 430 527 Z" fill={`url(#${gradient})`} />
      <text x="627" y="582" textAnchor="middle" fill="#f7f6f1" fontFamily="Arial, sans-serif" fontSize="54" fontWeight="700">{cue.title[lang]}</text>
      <path d="M 119 630 H 1140" stroke="#252720" strokeWidth="4" />
      <path d="M 489 630 H 768" stroke={`url(#${gradient})`} strokeWidth="6" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress(cue.start + .3, .7)} />
      {years.map((year, i) => {
        const x = [181, 336, 489, 628, 768, 923, 1078][i]
        const fill = i === 2 ? '#ed321e' : i === 3 || i === 4 ? '#f7c708' : '#252720'
        return <g key={i}><circle cx={x} cy="630" r="13" fill={fill} /><text x={x} y="692" textAnchor="middle" fill={fill} fontFamily="Arial, sans-serif" fontSize="36" fontWeight="700">{year}</text></g>
      })}
    </g> : cue.kind === 'genres' ? <g>
      <text x="385" y="187" textAnchor="middle" fontSize="56" fontFamily="Arial, sans-serif" fontWeight="700" fill="#f5f5f5" stroke="#121212" strokeWidth="2" paintOrder="stroke">{cue.title[lang]}</text>
      <path d="M 350 114 C 247 145 240 224 333 244 C 449 274 533 183 485 131 C 450 92 371 82 315 109" fill="none" stroke="#790909" strokeWidth="8" strokeLinecap="round" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress(cue.start, 1.3)} />
      {cue.items?.map((item, i) => {
        const p = progress(item.at, .4)
        const x = [1045, 1078, 982][i] ?? 1045
        const y = [302, 484, 648][i] ?? 302
        const left = [928, 906, 848][i] ?? 928
        const right = [1168, 1255, 1130][i] ?? 1168
        return <g key={item.text.en} opacity={p}>
          <text x={x} y={y} textAnchor="middle" fontSize="52" fontFamily="Arial, sans-serif" fontWeight="700" fill="#fff8f3" stroke="#d6747a" strokeWidth="1" paintOrder="stroke">{item.text[lang]}</text>
          <g opacity={progress(item.at + .15)}>
            <path d={`M ${right} ${y + 30} Q ${(left + right) / 2} ${y + 44} ${left} ${y + 25}`} fill="none" stroke="#790909" strokeWidth="6" pathLength="1" strokeDasharray="1" strokeDashoffset={1 - progress(item.at + .15, .5)} />
            <path d={`M ${left - 7} ${y + 25} l 27 -3 l -3 14 Z`} fill="#790909" />
          </g>
        </g>
      })}
    </g> : cue.kind === 'teaching' ? <g>
      <text x="128" y="612" fill="#ed6b32" fontSize="70" fontWeight="800">{cue.title[lang]}</text>
      <text x="198" y="600" fill="#fff" stroke="#24140d" strokeWidth="1" paintOrder="stroke" fontSize="28" fontWeight="700">{cue.label[lang]}</text>
      <text x="198" y="639" fill="#fff" stroke="#24140d" strokeWidth="1" paintOrder="stroke" fontSize="23">{cue.detail?.[lang]}</text>
    </g> : null}
  </svg>
}
