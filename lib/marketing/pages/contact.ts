/** Topic chips on /contact, each mapped to a subject `/api/contact` whitelists. */
export const CONTACT_TOPICS = [
  { key: 'general', subject: 'General Inquiry' },
  { key: 'support', subject: 'Technical Support' },
  { key: 'billing', subject: 'Billing' },
  { key: 'partnership', subject: 'Partnership' },
  { key: 'feedback', subject: 'Feedback' },
] as const

export type ContactTopic = (typeof CONTACT_TOPICS)[number]['key']
export type ContactField = 'name' | 'email' | 'topic' | 'message'
export interface ContactValues { name: string; email: string; topic: string; message: string }

/** Same pattern the API route checks. */
export const CONTACT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function topicSubject(topic: string): string | undefined {
  return CONTACT_TOPICS.find(t => t.key === topic)?.subject
}

/** Mirrors the API route's rules, so the form only posts what the server will accept. Returns one entry per failing field. */
export function validateContact(v: ContactValues): Partial<Record<ContactField, ContactField>> {
  const errors: Partial<Record<ContactField, ContactField>> = {}
  if (v.name.trim().length < 2) errors.name = 'name'
  if (!CONTACT_EMAIL_RE.test(v.email.trim())) errors.email = 'email'
  if (!topicSubject(v.topic)) errors.topic = 'topic'
  if (v.message.trim().length < 10) errors.message = 'message'
  return errors
}
