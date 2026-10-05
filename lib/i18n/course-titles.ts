import type { Locale } from './index'
/** Known catalog title with its source saved in the wrong language column. */
export function courseTitle(value: string, locale: Locale): string {
  if (['Solfeo Aplicado', 'Applied Solfège'].includes(value.trim())) return locale === 'es' ? 'Solfeo Aplicado' : 'Applied Solfège'
  return value
}
