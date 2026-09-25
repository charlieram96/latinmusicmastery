import { cn } from '@/lib/utils'

/** Circular course progress with the percentage in the middle (course page summary and phone bar). */
export function ProgressRing({ pct, size = 56 }: { pct: number; size?: number }) {
  const stroke = 4
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <span className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} className="fill-none stroke-foreground/10" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - Math.min(1, pct / 100))}
          className={cn('fill-none', pct >= 100 ? 'stroke-success' : 'stroke-primary')}
        />
      </svg>
      <span className={cn('absolute font-bold tabular-nums', size < 50 ? 'text-[11px]' : 'text-[13px]')}>{pct}%</span>
    </span>
  )
}
