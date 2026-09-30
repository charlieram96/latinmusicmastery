import { sleeveLook } from '@/lib/marketing/sleeve'

/** Record-sleeve cover (title + corner labels over a seeded palette and motif). */
export function Sleeve({ title, topLeft, topRight, seed, className = '' }: { title: React.ReactNode; topLeft?: string; topRight?: string; seed: string; className?: string }) {
  const look = sleeveLook(seed)
  return (
    <div className={`sleeve ${className}`} style={{ ['--bg' as string]: look.bg, ['--ink' as string]: look.ink, ['--motif' as string]: look.motif }}>
      {topLeft && <span className="si">{topLeft}</span>}
      {topRight && <span className="sc">{topRight}</span>}
      <span className="st">{title}</span>
    </div>
  )
}
