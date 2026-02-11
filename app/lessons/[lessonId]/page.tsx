import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{
    lessonId: string
  }>
}

export default async function LessonPage({ params }: PageProps) {
  const { lessonId } = await params
  redirect(`/modules/${lessonId}`)
}
