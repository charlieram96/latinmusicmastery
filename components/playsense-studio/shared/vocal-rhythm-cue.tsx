import type { VocalRhythmPhrase } from '@/lib/playsense-studio/cascara-paso-presentation'
import { CASCARA_VOCAL_PATTERNS } from '@/lib/playsense-studio/cascara-paso-presentation'

/** A teaching overlay, not an editable/graded score. Follows the decoded media clock. */
export function VocalRhythmCue({ phrase, time, lang, reduced = false }: { phrase: VocalRhythmPhrase; time: number; reduced?: boolean; lang: 'es' | 'en' }) {
  const active = phrase.hits.findIndex((hit, i) => time >= hit.at && time < (phrase.hits[i + 1]?.at ?? phrase.end))
  const current = phrase.hits[active]
  const bar = (current ?? phrase.hits[0]).bar
  const pattern = CASCARA_VOCAL_PATTERNS[bar]
  const title = lang === 'es'
    ? `CÁSCARA · ${bar === 0 ? 'PRIMER' : 'SEGUNDO'} COMPÁS`
    : `CÁSCARA · ${bar === 0 ? 'FIRST' : 'SECOND'} BAR`
  const entrance = reduced ? 1 : Math.max(0, Math.min(1, (time - phrase.start) / .25))
  return <svg className="lmm-reference-layer" viewBox="0 0 1280 720" role="img" aria-label={title}>
    <g transform="translate(22 104)">
      <rect width="396" height="166" rx="18" fill="#171c32" fillOpacity=".93" stroke="#ff8a12" strokeOpacity=".7" />
      <text x="20" y="29" fill="#ff941c" fontSize="18" fontWeight="800">{title}</text>
      <g data-vocal-bar={bar + 1} transform="translate(0 44)">
        <text x="20" y="17" fill="#fff4db" fontSize="16" fontWeight="700">{lang === 'es' ? `Compás ${bar + 1}` : `Bar ${bar + 1}`} · 4/4</text>
        {[0,1,2,3,4].map(line => <line key={line} x1="20" x2="376" y1={42 + line * 7} y2={42 + line * 7} stroke="#aeb8cc" strokeOpacity=".42" />)}
        <path d="M20 42V70 M371 42V70 M376 42V70" stroke="#dbe0ec" strokeWidth="2" />
        {pattern.map((note, i) => {
          const x = 44 + i * 44, y = note.low ? 70 : 56
          const selected = current?.bar === bar && current?.slot === i
          const syllable = phrase.hits.find(hit => hit.bar === bar && hit.slot === i)?.syllable ?? note.syllable
          return <g key={i} data-vocal-active={selected || undefined}>
            {selected && <rect x={x-19} y="24" width="38" height="80" rx="8" fill="#ff8a12" fillOpacity=".25" />}
            <text x={x} y="34" textAnchor="middle" fill="#aeb8cc" fontSize="12">{i % 2 === 0 ? i / 2 + 1 : '·'}</text>
            <path d={`M${x-5} ${y}h10 M${x} ${y-5}v10 M${x+5} ${y}V39`} stroke={selected ? '#ff9a22' : '#fff3d8'} strokeWidth="2" />
            {i % 2 === 0 && <path d={`M${x+5} 39h44`} stroke="#fff3d8" strokeWidth="4" />}
            <text x={x} y="96" textAnchor="middle" fill={selected ? '#ff9a22' : '#fff3d8'} fontSize="18" fontWeight="800">{syllable}</text>
          </g>
        })}
      </g>
    </g>
    <g transform={`translate(42 ${290 + (1 - entrance) * 12})`} opacity={entrance}>
      <rect width="144" height="44" rx="14" fill="#ff8a12" />
      <path d="M22 0l10-9 10 9" fill="#ff8a12" />
      <text x="72" y="29" textAnchor="middle" fill="#171c32" fontSize="21" fontWeight="800">{lang === 'es' ? '¡Cántala!' : 'Sing it!'}</text>
    </g>
  </svg>
}
