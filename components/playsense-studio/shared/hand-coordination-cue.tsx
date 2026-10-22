import type { HandCoordinationCue } from '@/lib/playsense-studio/hand-coordination'

/** Silent visual guide: both rows share the same authored subdivisions. */
export function HandCoordinationGrid({ cue, slot, lang }: { cue: HandCoordinationCue; slot: number; lang: 'es' | 'en' }) {
  const es = lang === 'es'
  const variant = cue.variant === 'complete' ? (es ? 'SOBAO COMPLETO' : 'COMPLETE SOBAO') : (es ? 'SOBAO SIMPLE' : 'SIMPLE SOBAO')
  const title = `${variant} · ${es ? 'COMPÁS' : 'BAR'} ${cue.bar}`
  const hasStrokes = cue.slots.some(note => note.leftStroke)
  const hit = cue.slots[slot]
  return <svg className="lmm-reference-layer" viewBox="0 0 1280 720" role="img" aria-label={title} data-hand-coordination>
    <g transform={`translate(${cue.position.x} ${cue.position.y})`}>
      <rect width="420" height={hasStrokes ? 166 : 144} rx="14" fill="#171c32" fillOpacity=".94" stroke="#ff941c" strokeOpacity=".7" />
      <text x="16" y="25" fill="#ff941c" fontSize="16" fontWeight="800">{title}</text>
      {(['right', 'left'] as const).map((hand, row) => <g key={hand}>
        <text x="16" y={62 + row * 32} fill={row ? '#63c9ef' : '#ffac3c'} fontSize="14" fontWeight="700">{es ? (row ? 'Izquierda' : 'Derecha') : (row ? 'Left hand' : 'Right hand')}</text>
        {cue.slots.map((note, index) => <g key={index}><rect x={112 + index * 36} y={42 + row * 32} width="30" height="25" rx="4"
          fill={note[hand] ? (row ? (note.leftStroke === 'muted' ? '#287ec4' : note.leftStroke === 'open' ? '#9ae9ff' : '#63c9ef') : '#ffac3c') : '#30354a'}
          fillOpacity={slot === index ? 1 : .45} stroke={slot === index ? '#fff4db' : 'none'} strokeWidth="2" />
          {row === 1 && note.leftStroke && <text x={127 + index * 36} y="91" textAnchor="middle" fill={note.leftStroke === 'muted' ? '#ffffff' : '#14283d'} fontSize="12" fontWeight="800">{note.leftStroke === 'muted' ? '×' : '○'}</text>}
        </g>)}
      </g>)}
      {cue.slots.map((_, index) => <text key={index} x={127 + index * 36} y="116" textAnchor="middle" fill="#e8e4dd" fontSize="11">{cue.isolated ? '•' : index % 2 === 0 ? index / 2 + 1 : '+'}</text>)}
      <text x="210" y="135" textAnchor="middle" fill="#fff4db" fontSize="11">{hit?.right && hit.left ? (es ? 'JUNTAS' : 'TOGETHER') : '\u00a0'}</text>
      {hasStrokes && <g fontSize="11" fill="#e8e4dd">
        <rect x="90" y="147" width="12" height="12" rx="2" fill="#287ec4" />
        <text x="108" y="157">× {es ? 'Ahogado' : 'Muted'}</text>
        <rect x="237" y="147" width="12" height="12" rx="2" fill="#9ae9ff" />
        <text x="255" y="157">○ {es ? 'Abierto' : 'Open'}</text>
      </g>}
    </g>
  </svg>
}
