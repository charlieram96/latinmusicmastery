/** Shapes and helpers for the Teachers page, usable from server and client code. */

export interface TeacherCourse {
  id: string
  title: string
  slug: string
  thumbnail_url: string | null
  musical_style: { name: string } | null
}

export interface TeacherCardData {
  id: string
  name: string
  image_url: string | null
  instrument: string | null
  bio: unknown
  email: string | null
  specialties: string[] | null
  courses: TeacherCourse[]
}

/** "Percusión, Timbal" → ["Percusión", "Timbal"]. Accepts comma, slash or middle-dot separators. */
export function splitInstruments(value: string | null | undefined): string[] {
  return (value ?? '')
    .split(/[,/·]/)
    .map((s) => s.trim())
    .filter(Boolean)
}
