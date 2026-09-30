import { useId } from 'react'

/** The LMM "M" mark with the brand amber→crimson gradient. */
export function LogoMark({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg viewBox="0 0 714 534" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={`lg${id}`} x1="832" y1="94" x2="-37" y2="524" gradientUnits="userSpaceOnUse">
          <stop stopColor="#FFA524" />
          <stop offset="1" stopColor="#FF324D" />
        </linearGradient>
      </defs>
      <path d="M138 271.8V383.2L357 492.5L485 414.5V533.7H576V254.5L357 385L138 271.8Z" fill={`url(#lg${id})`} />
      <path d="M0 533.2V0L91 54.5V442.9H142.8L238.6 489.5V533.2H0Z" fill={`url(#lg${id})`} />
      <path d="M138.8 212.5V84L359.9 219.5L714 1.5V534H622.5V172.1L357 330L138.8 212.5Z" fill={`url(#lg${id})`} />
    </svg>
  )
}
