'use client'

import { useState } from 'react'
import { useTranslation } from '@/components/language-provider'

/** Copies the address; if the clipboard is unavailable, selects the text so the visitor can copy it. */
export function CopyEmail({ email, targetId }: { email: string; targetId: string }) {
  const { t } = useTranslation()
  const [state, setState] = useState<'idle' | 'copied' | 'selected'>('idle')

  const selectText = () => {
    const el = document.getElementById(targetId)
    const sel = window.getSelection()
    if (!el || !sel) return
    const range = document.createRange()
    range.selectNodeContents(el)
    sel.removeAllRanges()
    sel.addRange(range)
    setState('selected')
  }

  const copy = () => {
    try {
      if (!navigator.clipboard) { selectText(); return }
      navigator.clipboard.writeText(email).then(() => setState('copied'), selectText)
    } catch {
      selectText()
    }
  }

  const label = state === 'copied' ? t('marketing.site.contact.copied') : state === 'selected' ? t('marketing.site.contact.selected') : t('marketing.site.contact.copy')
  return (
    <button type="button" className="btn btn-ghost btn-sm copy" onClick={copy} aria-live="polite">{label}</button>
  )
}
