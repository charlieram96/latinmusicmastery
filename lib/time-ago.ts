export type TimeAgoLocale = 'en' | 'es'

type Unit = 'm' | 'h' | 'd' | 'w' | 'mo' | 'y'

function label(n: number, unit: Unit, locale: TimeAgoLocale): string {
  if (locale === 'es') {
    const es: Record<Unit, string> = {
      m: 'min',
      h: 'h',
      d: 'd',
      w: 'sem',
      mo: n === 1 ? 'mes' : 'meses',
      y: n === 1 ? 'año' : 'años',
    }
    return `hace ${n} ${es[unit]}`
  }
  return `${n}${unit} ago`
}

export function timeAgo(dateString: string | null | undefined, locale: TimeAgoLocale = 'en'): string {
  if (!dateString) return ''
  const now = Date.now()
  const then = new Date(dateString).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return locale === 'es' ? 'justo ahora' : 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return label(minutes, 'm', locale)
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return label(hours, 'h', locale)
  const days = Math.floor(hours / 24)
  if (days < 7) return label(days, 'd', locale)
  const weeks = Math.floor(days / 7)
  if (weeks < 4) return label(weeks, 'w', locale)
  const months = Math.floor(days / 30)
  if (months < 12) return label(months, 'mo', locale)
  const years = Math.floor(days / 365)
  return label(years, 'y', locale)
}
