import type { PercussionStaffCue, PercussionStroke } from '@/lib/playsense-studio/percussion-staff'
import { teachingStrokeNotation, teachingNoteDuration } from '@/lib/playsense-studio/percussion-staff'

export function PercussionHead({ kind, x, y, color }: { kind: PercussionStroke; x:number; y:number; color:string }) {
  return <g data-stroke={kind} stroke={color} strokeWidth="1.8">
    {kind === 'muted' && <circle cx={x} cy={y} r="6" fill="#171c32" />}
    {kind === 'open' && <g data-notehead="slashed-open"><ellipse cx={x} cy={y} rx="6" ry="4" transform={`rotate(-20 ${x} ${y})`} fill="#171c32" /><path d={`M${x-5} ${y+5}l10-10`} /></g>}
    {(kind === 'cascara' || kind === 'cascara-low') && <path data-notehead={teachingStrokeNotation(kind,'right').notehead} d={`M${x-4} ${y}h8 M${x} ${y-4}v8`} />}
    {kind === 'muted' && <path d={`M${x-3.5} ${y-3.5}l7 7m-7 0l7-7`} />}
    {kind === 'rim' && <path data-notehead="x" d={`M${x-4} ${y-4}l8 8m-8 0l8-8`} />}
    {kind === 'tom' && <ellipse cx={x} cy={y} rx="5" ry="3.5" fill={color} />}
  </g>
}

/** Shared media clock: one beamed fill voice, or independent Sobao voices. */
export function PercussionStaff({ cue, slot, lang }: { cue:PercussionStaffCue; slot:number; lang:'es'|'en' }) {
  const es = lang === 'es'
  const joined = cue.section === 'cascara' && !cue.closing
  const title = cue.section === 'sobao' ? 'CÁSCARA CON SOBAO' : (es ? 'CÁSCARA · RELLENO' : 'CÁSCARA · LEFT-HAND FILL')
  return <svg className="lmm-reference-layer" viewBox="0 0 1280 720" role="img" aria-label={title} data-percussion-staff>
    <g transform={`translate(${cue.position.x} ${cue.position.y})`}>
      <rect width="420" height="232" rx="14" fill="#171c32" fillOpacity=".95" stroke="#ff941c" strokeOpacity=".7" />
      <text x="210" y="25" textAnchor="middle" fill="#ff941c" fontSize="16" fontWeight="800">{title}</text>
      <text x="16" y="46" fill="#e8e4dd" fontSize="12">Timbal · 4/4</text>
      <text x="402" y="46" textAnchor="end" fill="#e8e4dd" fontSize="12">LMM</text>
      <text x="16" y="65" fill="#aeb8cc" fontSize="12">♩ ≈ 100</text>
      <text x="402" y="65" textAnchor="end" fill="#aeb8cc" fontSize="12">{cue.closing ? (es ? 'Cierre' : 'Ending') : `${es ? 'Compás' : 'Bar'} ${cue.bar}`}{cue.call ? (es ? ' · Llamado' : ' · Transition') : ''}</text>
      {[0,1,2,3,4].map(line => <line key={line} x1="20" x2="400" y1={100+line*10} y2={100+line*10} stroke="#aeb8cc" strokeOpacity=".55" />)}
      <path d="M20 100V140 M394 100V140 M400 100V140 M27 110V130 M32 110V130" fill="none" stroke="#e8e4dd" strokeWidth="2" />
      {cue.bar === 1 && !cue.closing && <g data-time-signature="4/4" fill="#e8e4dd" fontFamily="serif" fontSize="23" fontWeight="bold" textAnchor="middle">
        <text x="44" y="118">4</text><text x="44" y="138">4</text>
      </g>}
      {slot >= 0 && <rect x={47+slot*44} y="73" width="28" height="101" rx="5" fill="#ff941c" fillOpacity=".18" />}
      {joined ? <g data-voice="joined">
        {cue.slots.map((hit,i) => {
          const kind=hit.right ?? hit.left
          const hand=hit.right ? 'right' : 'left'
          const x=61+i*44, stemX=x+6, beamY=87
          const color=slot===i ? '#fff4db' : hand==='right' ? '#ffac3c' : '#9ae9ff'
          if (!kind) return <g key={i} data-rest data-eighth-rest transform="translate(0 -30)" fill="#ffac3c" stroke="#ffac3c" opacity=".55"><circle cx={x-2} cy="132" r="2.4" /><path d={`M${x-2} 134q6 0 7-5l-5 15`} fill="none" strokeWidth="1.4" /></g>
          const notation=teachingStrokeNotation(kind,hand)
          const duration=teachingNoteDuration(cue,i,hand)
          const hasNext=i%4!==3 && !!(cue.slots[i+1]?.right ?? cue.slots[i+1]?.left)
          const hasPrevious=i%4!==0 && !!(cue.slots[i-1]?.right ?? cue.slots[i-1]?.left)
          return <g key={i} data-hand={hand} data-slot={i} data-duration={duration} data-staff-line={notation.staffLine} data-active={slot===i || undefined}>
            <PercussionHead kind={kind} x={x} y={notation.y} color={color} />
            <path data-stem="up" d={`M${stemX} ${notation.y}V${beamY}`} stroke={color} strokeWidth="1.7" />
            {duration===.5 && (hasNext ? <path data-beam d={`M${stemX} ${beamY}h44`} stroke="#e8e4dd" strokeWidth="3" /> : !hasPrevious && <path data-flag d={`M${stemX} ${beamY}q12 5 7 16`} fill="none" stroke={color} strokeWidth="2" />)}
          </g>
        })}
      </g> : (['right','left'] as const).map((hand, row) => <g key={hand} data-hand={hand}>
        {cue.slots.map((hit, i) => {
          if (cue.closing && hand === 'left') return null
          // The opening quarter occupies both eighth subdivisions in this voice.
          // Keep the other hand's intervening attack visible and synchronized.
          if (i > 0 && cue.slots[i-1][hand] && teachingNoteDuration(cue,i-1,hand) === 1) return null
          const pairedRest = !hit[hand] &&
            cue.slots[i%2===0 ? i+1 : i-1]?.[hand] === null
          if (pairedRest && i%2===1) return null
          const kind = hit[hand], notation=kind ? teachingStrokeNotation(kind,hand) : null
          const x=61+i*44, y=notation?.y ?? (row ? 135 : 125), stemX=x+(row ? -6 : 6), beamY=row ? 172 : 87
          const duration=teachingNoteDuration(cue,i,hand)
          const color = slot===i ? '#fff4db' : row ? '#9ae9ff' : '#ffac3c'
          const partnerIndex = i%2===0 ? i+1 : i-1
          const partner = cue.slots[partnerIndex]?.[hand] && teachingNoteDuration(cue,partnerIndex,hand) === .5
          return <g key={i} data-slot={i} data-duration={kind ? duration : pairedRest ? 1 : .5} data-rest={!kind || undefined} data-staff-line={notation?.staffLine} data-active={slot===i || undefined}>
            {kind ? <>
              <PercussionHead kind={kind} x={x} y={y} color={color} />
              <path d={`M${stemX} ${y}V${beamY}`} stroke={color} strokeWidth="1.7" />
              {duration === .5 && (partner ? i%2===0 && <path data-beam d={`M${stemX} ${beamY}h44`} stroke={row ? '#9ae9ff' : '#ffac3c'} strokeWidth="3" />
                : <path data-flag d={row ? `M${stemX} ${beamY}q12-5 7-16` : `M${stemX} ${beamY}q12 5 7 16`} fill="none" stroke={color} strokeWidth="2" />)}
            </> : pairedRest ? <path data-quarter-rest transform={`translate(0 ${row ? 20 : -20})`} d={`M${x-3} ${y-9}l6 6-6 6 6 5q-9-4-6 5q-8-8 2-9l-5-5 5-5z`} fill={color} opacity=".55" /> : <g data-eighth-rest transform={`translate(0 ${row ? 20 : -20})`} fill={color} stroke={color} opacity=".55"><circle cx={x-2} cy={y-3} r="2.4" /><path d={`M${x-2} ${y-1}q6 0 7-5l-5 15`} fill="none" strokeWidth="1.4" /></g>}
          </g>
        })}
      </g>)}
      {cue.slots.map((_,i) => <text key={i} x={61+i*44} y="188" textAnchor="middle" fill="#aeb8cc" fontSize="11">{i%2===0 ? i/2+1 : '+'}</text>)}
      <g data-staff-legend fontSize="13.5" fontWeight="600" textAnchor="middle">
        {([
          { kind:'cascara', label:es ? 'Derecha' : 'Right', color:'#ffac3c' },
          { kind:'cascara-low', label:es ? 'Izquierda' : 'Left', color:'#9ae9ff' },
          { kind:'muted', label:es ? 'Apagado' : 'Muted', color:'#9ae9ff' },
          { kind:'open', label:es ? 'Abierto' : 'Open', color:'#9ae9ff' },
        ] as const).map((entry,i) => <g key={entry.kind}>
          <PercussionHead kind={entry.kind} x={32+i*96} y={210} color={entry.color} />
          <text x={76+i*96} y="214.5" fill={i<2 ? entry.color : '#e8e4dd'}>{entry.label}</text>
        </g>)}
      </g>
    </g>
  </svg>
}
