import { COURSE_INSTRUMENTS, getCourseInstrumentLabel } from '@/lib/instruments'

const key = (value: string) => value.trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()

/** A course has one classification. Teacher specialties are never course categories. */
export function courseInstrumentClassifications(value: string | null | undefined, options: readonly string[] = COURSE_INSTRUMENTS): string[] {
  const selected = key(value ?? '')
  return options.filter((instrument) =>
    selected === key(instrument) || selected === key(getCourseInstrumentLabel(instrument, 'es'))
  )
}

export function matchesCourseInstrument(value: string | null | undefined, filter: string, options: readonly string[] = COURSE_INSTRUMENTS): boolean {
  const canonical = courseInstrumentClassifications(filter, options)[0]
  return canonical
    ? courseInstrumentClassifications(value, options).includes(canonical)
    : key(value ?? '') === key(filter)
}

export function selectedCourseInstrument(value: string | null | undefined, options: readonly string[] = COURSE_INSTRUMENTS): string | null {
  return courseInstrumentClassifications(value, options)[0] ?? null
}
