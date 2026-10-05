import { getServerTranslator } from '@/lib/i18n/server'

export default async function CourseEditorLoading() {
  const { locale } = await getServerTranslator()
  return <div aria-busy="true" className="flex min-h-screen flex-col bg-background">
    <div className="border-b p-4 font-semibold" role="status">{locale === 'es' ? 'Abriendo editor del curso…' : 'Opening course editor…'}</div>
    <div aria-hidden className="grid flex-1 grid-cols-[240px_1fr]">
      <div className="space-y-4 border-r p-4">{[0, 1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-muted motion-safe:animate-pulse" />)}</div>
      <div className="p-8"><div className="h-40 rounded-xl bg-muted motion-safe:animate-pulse" /></div>
    </div>
  </div>
}
