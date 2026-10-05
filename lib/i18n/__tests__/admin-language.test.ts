import { describe, expect, it } from 'vitest'
import { adminLabel } from '../admin-labels'
import { localizeCourse, pick } from '../localize'
import { instrumentLabel } from '../instruments'

describe('consistent administration language', () => {
  it('translates catalog controls while preserving English', () => {
    for (const [en, es] of [['Courses', 'Cursos'], ['Draft', 'Borrador'], ['Unassigned', 'Sin asignar']]) {
      expect(adminLabel(en, 'es')).toBe(es)
      expect(adminLabel(en, 'en')).toBe(en)
    }
    expect(adminLabel('Notes &amp; rich content', 'en')).toBe('Notes & rich content')
  })
  it('uses authored catalog translations and retains identifiers and both source fields', () => {
    const source = { id: 'course-1', title: 'Guitar Fundamentals', title_es: 'Fundamentos de Guitarra', instrument: 'Guitar' }
    expect(localizeCourse({ ...source }, 'es')).toEqual({ ...source, title: source.title_es })
    expect(localizeCourse({ ...source }, 'en')).toEqual(source)
  })
  it('displays the known Spanish-only course correctly in either language', () => {
    expect(pick('en', 'Solfeo Aplicado', '')).toBe('Applied Solfège')
    expect(pick('es', 'Solfeo Aplicado', '')).toBe('Solfeo Aplicado')
    expect(pick('es', 'Solfeo Aplicado', 'Título personalizado')).toBe('Título personalizado')
  })
  it('localizes compound instruments and educational categories without changing the filter key', () => {
    expect(instrumentLabel('Saxophone, Piano, Theoretical', 'es')).toBe('Saxofón, Piano, Teórico')
    expect(instrumentLabel('Theoretical', 'en')).toBe('Theoretical')
    expect(instrumentLabel('Demonstrative', 'es')).toBe('Demostrativo')
    expect(instrumentLabel('Practical', 'es')).toBe('Práctico')
  })
})
