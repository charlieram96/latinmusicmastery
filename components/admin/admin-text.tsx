'use client'
import { useTranslation } from '@/components/language-provider'
import { adminLabel } from '@/lib/i18n/admin-labels'
/** Text-only boundary for static administrative labels on server and client pages. */
export function AdminText({ text }: { text: string }) {
  const { locale } = useTranslation()
  return <>{adminLabel(text, locale)}</>
}
