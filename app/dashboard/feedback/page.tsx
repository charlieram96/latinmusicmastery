import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { FeedbackView } from './feedback-view'

export default async function FeedbackPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get user's feedback requests
  const { data: feedbackRequests } = await supabase
    .from('feedback_requests')
    .select(`
      *,
      teachers (
        id,
        name,
        image_url,
        instrument
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  // Get all teachers for the request form
  const { data: teachers } = await supabase
    .from('teachers')
    .select('id, name, image_url, instrument')
    .order('name')

  return <FeedbackView feedbackRequests={feedbackRequests} teachers={teachers} />
}
