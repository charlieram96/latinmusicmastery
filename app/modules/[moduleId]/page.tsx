import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{
    moduleId: string
  }>
}

export default async function ModuleRedirect({ params }: PageProps) {
  const { moduleId } = await params
  redirect(`/dashboard/modules/${moduleId}`)
}
