import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ExerciseEditorForm } from './exercise-editor-form'

interface Props {
  params: Promise<{ id: string }>
}

export default async function AdminPlaySenseEditPage({ params }: Props) {
  const { id } = await params
  const isNew = id === 'new'
  const supabase = await createClient()

  let exercise = null
  if (!isNew) {
    const { data, error } = await supabase
      .from('play_sense_exercises')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) redirect('/admin/play-sense')
    exercise = data
  }

  return (
    <div className="container mx-auto px-6 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">
        {isNew ? 'Create Exercise' : 'Edit Exercise'}
      </h1>
      <ExerciseEditorForm exercise={exercise} isNew={isNew} />
    </div>
  )
}
