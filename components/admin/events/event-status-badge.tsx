'use client'

import { useTranslation } from '@/components/language-provider'
import { Badge } from '@/components/ui/badge'
import { adminLabel } from '@/lib/i18n/admin-labels'

const VARIANT = { draft: 'secondary', published: 'success', closed: 'warning', cancelled: 'danger' } as const
const LABELS: Record<string, string> = { draft: 'Draft', published: 'On sale', closed: 'Sales closed', cancelled: 'Cancelled' }

export function EventStatusBadge({ status }: { status: string }) {
  const { locale } = useTranslation()
  return (
    <Badge variant={VARIANT[status as keyof typeof VARIANT] ?? 'secondary'}>
      {adminLabel(LABELS[status] ?? status, locale)}
    </Badge>
  )
}
