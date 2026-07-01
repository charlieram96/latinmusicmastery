import type { QuizQuestion } from '@/types/modules'

export type Choice = { id: string; text: string }
export type Pair = { id: string; left: string; right: string }
export type Blank = { id: string; answer: string }
export type OrderItem = { id: string; text: string; correctPosition: number }
export type AudioChoice = { id: string; text?: string; audioUrl?: string }
export type AssemblyZone = { id: string; label: string; x: number; y: number; width: number; height: number }
export type AssemblyPart = { id: string; label: string; imageUrl: string; correctZoneId: string }

export function norm(s: string): string {
  return s.toLowerCase().trim()
}

/** Stable shuffle seeded by a string so option order doesn't reshuffle on every render. */
export function shuffleStable<T>(arr: T[], seed: string): T[] {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    h = (h * 1103515245 + 12345) & 0x7fffffff
    const j = h % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Grade a single question against the student's answer. Behavior preserved from the original QuizRunner. */
export function gradeQuestion(q: QuizQuestion, answer: unknown): boolean {
  const opts = (q.options ?? {}) as Record<string, unknown>
  switch (q.question_type) {
    case 'multiple_choice':
    case 'audio_choice':
      return typeof answer === 'string' && !!q.correct_answer && answer === q.correct_answer
    case 'instrument_assembly': {
      const parts = (opts.parts as AssemblyPart[]) ?? []
      const placed = (answer as Record<string, string>) ?? {}
      return parts.length > 0 && parts.every((p) => placed[p.id] === p.correctZoneId)
    }
    case 'true_false':
      return typeof answer === 'string' && norm(answer) === norm(q.correct_answer ?? '')
    case 'text_answer':
    case 'audio':
      return typeof answer === 'string' && norm(answer) === norm(q.correct_answer ?? '')
    case 'fill_in_blank': {
      const blanks = (opts.blanks as Blank[]) ?? []
      const given = (answer as Record<string, string>) ?? {}
      return blanks.length > 0 && blanks.every((b) => norm(given[b.id] ?? '') === norm(b.answer))
    }
    case 'matching_pairs': {
      const pairs = (opts.pairs as Pair[]) ?? []
      const given = (answer as Record<string, string>) ?? {}
      return pairs.length > 0 && pairs.every((p) => norm(given[p.id] ?? '') === norm(p.right))
    }
    case 'ordering_sequence': {
      const items = (opts.items as OrderItem[]) ?? []
      const order = (answer as string[]) ?? []
      if (order.length !== items.length || items.length === 0) return false
      const byId = new Map(items.map((it) => [it.id, it]))
      return order.every((id, idx) => byId.get(id)?.correctPosition === idx)
    }
    default:
      return false
  }
}

/** Whether the student has provided enough of an answer to allow grading. */
export function hasAnswer(q: QuizQuestion, answer: unknown): boolean {
  if (
    q.question_type === 'fill_in_blank' ||
    q.question_type === 'matching_pairs' ||
    q.question_type === 'instrument_assembly'
  ) {
    return !!answer && Object.keys(answer as object).length > 0
  }
  if (q.question_type === 'ordering_sequence') return true
  return typeof answer === 'string' && answer.trim().length > 0
}

/** Friendly label for the correct answer, used on the results review. */
export function correctAnswerLabel(q: QuizQuestion): string {
  const opts = (q.options ?? {}) as Record<string, unknown>
  if (q.question_type === 'multiple_choice') {
    const choices = (opts.choices as Choice[]) ?? []
    return choices.find((c) => c.id === q.correct_answer)?.text ?? q.correct_answer ?? ''
  }
  if (q.question_type === 'audio_choice') {
    const choices = (opts.choices as AudioChoice[]) ?? []
    const idx = choices.findIndex((c) => c.id === q.correct_answer)
    if (idx < 0) return q.correct_answer ?? ''
    return choices[idx].text?.trim() || `Clip ${idx + 1}`
  }
  if (q.question_type === 'instrument_assembly') {
    const parts = (opts.parts as AssemblyPart[]) ?? []
    const zones = (opts.zones as AssemblyZone[]) ?? []
    const zoneLabel = new Map(zones.map((z) => [z.id, z.label]))
    return parts.map((p) => `${p.label} → ${zoneLabel.get(p.correctZoneId) ?? '?'}`).join(', ')
  }
  return q.correct_answer ?? ''
}
