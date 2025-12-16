import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{
    courseId: string
  }>
}

export default async function OldCoursePage({ params }: PageProps) {
  const { courseId } = await params
  redirect(`/dashboard/course/${courseId}`)
}
