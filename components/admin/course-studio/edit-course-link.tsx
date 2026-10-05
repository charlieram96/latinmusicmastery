'use client'

import Link, { useLinkStatus } from 'next/link'
import { Loader2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useTranslation } from '@/components/language-provider'

function EditLabel() {
  const { pending } = useLinkStatus()
  const { locale } = useTranslation()
  return <span className="inline-flex items-center gap-2" role="status" aria-live="polite" aria-busy={pending}>
    {pending ? <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> : <Pencil aria-hidden className="h-4 w-4" />}
    {locale === 'es' ? (pending ? 'Abriendo curso…' : 'Editar curso') : (pending ? 'Opening course…' : 'Edit Course')}
  </span>
}

export function EditCourseLink({ courseId }: { courseId: string }) {
  return <Button asChild className="flex-1 gap-2" variant="outline">
    <Link href={`/admin/courses/${courseId}`}><EditLabel /></Link>
  </Button>
}
