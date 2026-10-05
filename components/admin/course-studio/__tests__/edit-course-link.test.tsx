// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
const state = vi.hoisted(() => ({ pending: false }))
vi.mock('next/link', () => ({ default: ({href,children,...props}: any) => <a href={href} {...props}>{children}</a>, useLinkStatus: () => state }))
vi.mock('@/components/language-provider', () => ({ useTranslation: () => ({ locale: 'es' }) }))
import { EditCourseLink } from '../edit-course-link'
it('preserves the course destination and gives feedback while navigation is pending', async () => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true)
  const host = document.createElement('div')
  const root = createRoot(host)
  try {
    await act(async () => root.render(<EditCourseLink courseId="timbal" />))
    expect(host.querySelector('a')?.getAttribute('href')).toBe('/admin/courses/timbal')
    expect(host.textContent).toBe('Editar curso')
    state.pending = true
    await act(async () => root.render(<EditCourseLink courseId="timbal" />))
    expect(host.textContent).toBe('Abriendo curso…')
    expect(host.querySelector('[aria-busy="true"]')).not.toBeNull()
  } finally { await act(async () => root.unmount()); state.pending = false; vi.unstubAllGlobals() }
})
