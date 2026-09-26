import { buildBackgroundArt, type BackgroundNote } from '@/lib/dashboard/page-background'

const ART = buildBackgroundArt(3)

function Note({ n }: { n: BackgroundNote }) {
  const t = `translate(${n.x} ${n.y}) rotate(${n.rotate}) scale(${n.scale})`
  if (n.kind === 'beamed') {
    return (
      <g transform={t}>
        <ellipse cx="0" cy="0" rx="7" ry="5" transform="rotate(-20)" />
        <ellipse cx="26" cy="-4" rx="7" ry="5" transform="rotate(-20 26 -4)" />
        <path d="M6 -2 V-34 M32 -6 V-38" fill="none" strokeWidth="2" />
        <path d="M6 -34 L32 -38 L32 -32 L6 -28 Z" />
      </g>
    )
  }
  return (
    <g transform={t}>
      <ellipse cx="0" cy="0" rx="7" ry="5" transform="rotate(-20)" />
      <path d="M6 -2 V-34" fill="none" strokeWidth="2" />
      {n.kind === 'eighth' && <path d="M6 -34 C14 -28 18 -22 14 -12" fill="none" strokeWidth="2" />}
    </g>
  )
}

/**
 * Faint musical backdrop for the dashboard home: wavy staff lines, scattered
 * notes, a 2-3 clave and a warm glow. Fixed behind the scrolling content, so
 * it never scrolls away; purely decorative.
 */
export function PageBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 bottom-0 top-[var(--header-h)] z-0 overflow-hidden md:left-16">
      <div className="absolute -right-[10%] -top-[20%] h-[80%] w-[70%] bg-[radial-gradient(closest-side,hsl(var(--primary)/0.12),transparent)]" />
      <svg className="absolute inset-0 h-full w-full text-foreground" viewBox={`0 0 ${ART.width} ${ART.height}`} preserveAspectRatio="xMidYMid slice">
        <g className="opacity-[0.07]" fill="none" stroke="currentColor" strokeWidth="1.2">
          {ART.staves.map((d, i) => <path key={i} d={d} />)}
        </g>
        <g className="opacity-[0.06]" fill="currentColor" stroke="currentColor">
          {ART.notes.map((n, i) => <Note key={i} n={n} />)}
        </g>
        <g className="opacity-[0.08]" fill="none" stroke="currentColor" strokeWidth="2">
          {ART.clave.map((c, i) => <circle key={i} cx={c.cx} cy={c.cy} r="11" />)}
        </g>
      </svg>
    </div>
  )
}
