import { describe, expect, it } from 'vitest'
import { CONTACT_TOPICS, validateContact } from '../contact'

const ok = { name: 'Ana', email: 'ana@example.com', topic: 'general', message: 'Hola, tengo una pregunta.' }

describe('CONTACT_TOPICS', () => {
  it('maps exactly onto the subjects /api/contact accepts', () => {
    expect(CONTACT_TOPICS.map(t => t.subject)).toEqual(['General Inquiry', 'Technical Support', 'Billing', 'Partnership', 'Feedback'])
  })
})

describe('validateContact', () => {
  it('accepts a complete message', () => {
    expect(validateContact(ok)).toEqual({})
  })
  it('requires a name of at least two characters', () => {
    expect(validateContact({ ...ok, name: ' A ' })).toEqual({ name: 'name' })
  })
  it('requires a valid email', () => {
    expect(validateContact({ ...ok, email: 'ana@' })).toEqual({ email: 'email' })
  })
  it('requires a known topic', () => {
    expect(validateContact({ ...ok, topic: 'spam' })).toEqual({ topic: 'topic' })
  })
  it('requires a trimmed message of at least ten characters', () => {
    expect(validateContact({ ...ok, message: '   short   ' })).toEqual({ message: 'message' })
  })
  it('reports every failing field', () => {
    expect(Object.keys(validateContact({ name: '', email: '', topic: '', message: '' })).sort()).toEqual(['email', 'message', 'name', 'topic'])
  })
})
