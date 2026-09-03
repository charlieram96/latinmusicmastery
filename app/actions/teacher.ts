'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/types/database'

// Get current teacher's profile
export async function getTeacherProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: teacher } = await supabase
    .from('teachers')
    .select('*')
    .eq('user_id', user.id)
    .single()

  return teacher
}

// Get feedback requests for the current teacher
export async function getTeacherFeedbackRequests(status?: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return []

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return []

  let query = supabase
    .from('feedback_requests')
    .select(`
      *,
      profiles:user_id (
        id,
        full_name,
        email
      )
    `)
    .eq('teacher_id', teacher.id)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data: requests } = await query

  return requests || []
}

// Get a single feedback request
export async function getFeedbackRequest(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return null

  const { data: request } = await supabase
    .from('feedback_requests')
    .select(`
      *,
      profiles:user_id (
        id,
        full_name,
        email
      )
    `)
    .eq('id', requestId)
    .eq('teacher_id', teacher.id)
    .single()

  return request
}

// Submit feedback response
export async function submitFeedbackResponse(
  requestId: string,
  formData: FormData
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  // Verify this teacher owns this feedback request
  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) throw new Error('Not a teacher')

  const { data: request } = await supabase
    .from('feedback_requests')
    .select('teacher_id')
    .eq('id', requestId)
    .single()

  if (request?.teacher_id !== teacher.id) {
    throw new Error('Unauthorized to respond to this request')
  }

  const responseMessage = formData.get('response_message') as string
  const responseVideoUrl = formData.get('response_video_url') as string

  const data = {
    response_message: responseMessage,
    response_video_url: responseVideoUrl || null,
    status: 'completed',
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('feedback_requests')
    .update(data)
    .eq('id', requestId)

  if (error) throw new Error(error.message)

  revalidatePath('/teacher/feedback')
  revalidatePath(`/teacher/feedback/${requestId}`)
  return { success: true }
}

// Mark feedback as in review
export async function markFeedbackInReview(requestId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) throw new Error('Not a teacher')

  const { error } = await supabase
    .from('feedback_requests')
    .update({
      status: 'in_review',
      updated_at: new Date().toISOString()
    })
    .eq('id', requestId)
    .eq('teacher_id', teacher.id)

  if (error) throw new Error(error.message)

  revalidatePath('/teacher/feedback')
  return { success: true }
}

// Update teacher profile (bio, image, specialties)
export async function updateTeacherProfile(input: {
  bio: Record<string, unknown> | null
  bio_es?: Record<string, unknown> | null
  image_url: string | null
  specialties: string | null
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) throw new Error('Unauthorized')

  const specialties = input.specialties
    ? input.specialties.split(',').map(s => s.trim()).filter(Boolean)
    : null

  const { error } = await supabase
    .from('teachers')
    .update({
      bio: input.bio as Json | null,
      // `undefined` leaves the column untouched for callers that don't send it.
      ...(input.bio_es !== undefined ? { bio_es: input.bio_es as Json | null } : {}),
      image_url: input.image_url,
      specialties,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)

  revalidatePath('/teacher')
  revalidatePath('/teacher/profile')
  return { success: true }
}

// Get teacher stats for dashboard
export async function getTeacherStats() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: teacher } = await supabase
    .from('teachers')
    .select('id')
    .eq('user_id', user.id)
    .single()

  if (!teacher) return null

  // Get pending count
  const { count: pendingCount } = await supabase
    .from('feedback_requests')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacher.id)
    .eq('status', 'pending')

  // Get in review count
  const { count: inReviewCount } = await supabase
    .from('feedback_requests')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacher.id)
    .eq('status', 'in_review')

  // Get completed this month
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count: completedThisMonth } = await supabase
    .from('feedback_requests')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')
    .gte('updated_at', startOfMonth.toISOString())

  // Get total completed
  const { count: totalCompleted } = await supabase
    .from('feedback_requests')
    .select('*', { count: 'exact', head: true })
    .eq('teacher_id', teacher.id)
    .eq('status', 'completed')

  return {
    pending: pendingCount || 0,
    inReview: inReviewCount || 0,
    completedThisMonth: completedThisMonth || 0,
    totalCompleted: totalCompleted || 0,
  }
}
