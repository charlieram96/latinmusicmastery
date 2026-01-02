import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { TeacherEditForm } from '@/components/admin/teacher-edit-form'

interface TeacherEditPageProps {
  params: Promise<{
    id: string
  }>
}

export default async function TeacherEditPage({ params }: TeacherEditPageProps) {
  const { id } = await params
  const supabase = await createClient()

  const { data: teacher } = await supabase
    .from('teachers')
    .select('*')
    .eq('id', id)
    .single()

  if (!teacher) {
    notFound()
  }

  return <TeacherEditForm teacher={teacher} />
}
