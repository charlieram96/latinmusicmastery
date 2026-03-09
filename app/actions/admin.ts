'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe'
import { PLAN_PRICES, getPlanPrice } from '@/lib/pricing'

// Countries
export async function createCountry(formData: FormData) {
  const supabase = await createClient()

  const data = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: formData.get('description') as string,
    image_url: formData.get('image_url') as string || null,
  }

  const { error } = await supabase.from('countries').insert(data)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/countries')
  redirect('/admin/countries')
}

export async function updateCountry(id: string, formData: FormData) {
  const supabase = await createClient()

  const data = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: formData.get('description') as string,
    image_url: formData.get('image_url') as string || null,
  }

  const { error } = await supabase.from('countries').update(data).eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/countries')
  redirect('/admin/countries')
}

export async function deleteCountry(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('countries').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/countries')
  return { success: true }
}

// Musical Styles
export async function createStyle(formData: FormData) {
  const supabase = await createClient()

  const data = {
    country_id: formData.get('country_id') as string,
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: formData.get('description') as string || null,
  }

  const { error } = await supabase.from('musical_styles').insert(data)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/styles')
  redirect('/admin/styles')
}

export async function updateStyle(id: string, formData: FormData) {
  const supabase = await createClient()

  const data = {
    country_id: formData.get('country_id') as string,
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: formData.get('description') as string || null,
  }

  const { error } = await supabase.from('musical_styles').update(data).eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/styles')
  redirect('/admin/styles')
}

export async function deleteStyle(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('musical_styles').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/styles')
  return { success: true }
}

// Courses
export async function createCourse(formData: FormData) {
  const supabase = await createClient()

  const data = {
    musical_style_id: formData.get('musical_style_id') as string,
    title: formData.get('title') as string,
    slug: formData.get('slug') as string,
    description: formData.get('description') as string || null,
    teacher_name: formData.get('teacher_name') as string,
    teacher_bio: formData.get('teacher_bio') as string || null,
    teacher_image_url: formData.get('teacher_image_url') as string || null,
    thumbnail_url: formData.get('thumbnail_url') as string || null,
    preview_video_url: formData.get('preview_video_url') as string || null,
    is_published: formData.get('is_published') === 'true',
    order_index: parseInt(formData.get('order_index') as string) || 0,
  }

  const { error } = await supabase.from('courses').insert(data)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/courses')
  redirect('/admin/courses')
}

export async function updateCourse(id: string, formData: FormData) {
  const supabase = await createClient()

  const data = {
    musical_style_id: formData.get('musical_style_id') as string,
    title: formData.get('title') as string,
    slug: formData.get('slug') as string,
    description: formData.get('description') as string || null,
    teacher_name: formData.get('teacher_name') as string,
    teacher_bio: formData.get('teacher_bio') as string || null,
    teacher_image_url: formData.get('teacher_image_url') as string || null,
    thumbnail_url: formData.get('thumbnail_url') as string || null,
    preview_video_url: formData.get('preview_video_url') as string || null,
    is_published: formData.get('is_published') === 'true',
    order_index: parseInt(formData.get('order_index') as string) || 0,
  }

  const { error } = await supabase.from('courses').update(data).eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/courses')
  redirect('/admin/courses')
}

export async function deleteCourse(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('courses').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/courses')
  return { success: true }
}

// Lessons
export async function createLesson(formData: FormData) {
  const supabase = await createClient()

  const data = {
    course_id: formData.get('course_id') as string,
    title: formData.get('title') as string,
    slug: formData.get('slug') as string,
    description: formData.get('description') as string || null,
    soundslice_embed_url: formData.get('soundslice_embed_url') as string || null,
    video_url: formData.get('video_url') as string || null,
    duration_minutes: parseInt(formData.get('duration_minutes') as string) || null,
    is_free: formData.get('is_free') === 'true',
    order_index: parseInt(formData.get('order_index') as string) || 0,
  }

  const { error } = await supabase.from('lessons').insert(data)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/lessons')
  redirect('/admin/lessons')
}

export async function updateLesson(id: string, formData: FormData) {
  const supabase = await createClient()

  const data = {
    course_id: formData.get('course_id') as string,
    title: formData.get('title') as string,
    slug: formData.get('slug') as string,
    description: formData.get('description') as string || null,
    soundslice_embed_url: formData.get('soundslice_embed_url') as string || null,
    video_url: formData.get('video_url') as string || null,
    duration_minutes: parseInt(formData.get('duration_minutes') as string) || null,
    is_free: formData.get('is_free') === 'true',
    order_index: parseInt(formData.get('order_index') as string) || 0,
  }

  const { error } = await supabase.from('lessons').update(data).eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/lessons')
  redirect('/admin/lessons')
}

export async function deleteLesson(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('lessons').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/lessons')
  return { success: true }
}

// Exercises
export async function createExercise(formData: FormData) {
  const supabase = await createClient()

  const optionsString = formData.get('options') as string
  const options = optionsString ? optionsString.split('\n').filter(o => o.trim()) : null

  const data = {
    lesson_id: formData.get('lesson_id') as string,
    title: formData.get('title') as string,
    description: formData.get('description') as string || null,
    question: formData.get('question') as string,
    question_type: formData.get('question_type') as 'multiple_choice' | 'text' | 'audio',
    options: options,
    correct_answer: formData.get('correct_answer') as string,
    explanation: formData.get('explanation') as string || null,
    order_index: parseInt(formData.get('order_index') as string) || 0,
  }

  const { error } = await supabase.from('exercises').insert(data)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/exercises')
  redirect('/admin/exercises')
}

export async function updateExercise(id: string, formData: FormData) {
  const supabase = await createClient()

  const optionsString = formData.get('options') as string
  const options = optionsString ? optionsString.split('\n').filter(o => o.trim()) : null

  const data = {
    lesson_id: formData.get('lesson_id') as string,
    title: formData.get('title') as string,
    description: formData.get('description') as string || null,
    question: formData.get('question') as string,
    question_type: formData.get('question_type') as 'multiple_choice' | 'text' | 'audio',
    options: options,
    correct_answer: formData.get('correct_answer') as string,
    explanation: formData.get('explanation') as string || null,
    order_index: parseInt(formData.get('order_index') as string) || 0,
  }

  const { error } = await supabase.from('exercises').update(data).eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/admin/exercises')
  redirect('/admin/exercises')
}

export async function deleteExercise(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('exercises').delete().eq('id', id)

  if (error) {
    return { error: error.message }
  }

  revalidatePath('/admin/exercises')
  return { success: true }
}

// === USER MANAGEMENT ===

export async function getUsers(options?: {
  search?: string
  isAdmin?: boolean
  isTeacher?: boolean
  subscriptionStatus?: 'all' | 'subscribed' | 'free'
  planType?: 'all' | 'instrument' | 'all_access'
  limit?: number
  offset?: number
}) {
  const supabase = await createClient()

  let query = supabase
    .from('profiles')
    .select(`
      *,
      subscriptions (
        id,
        status,
        plan_type,
        instrument,
        current_period_end
      ),
      teachers!teachers_user_id_fkey (
        id,
        name,
        instrument
      )
    `, { count: 'exact' })

  if (options?.search) {
    query = query.or(`email.ilike.%${options.search}%,full_name.ilike.%${options.search}%`)
  }

  if (options?.isAdmin !== undefined) {
    query = query.eq('is_admin', options.isAdmin)
  }

  query = query
    .order('created_at', { ascending: false })
    .range(options?.offset || 0, (options?.offset || 0) + (options?.limit || 50) - 1)

  const { data, count, error } = await query

  if (error) throw new Error(error.message)

  // Filter by teacher status in memory if needed
  let users = data || []
  if (options?.isTeacher === true) {
    users = users.filter((u: any) => u.teachers && u.teachers.length > 0)
  } else if (options?.isTeacher === false) {
    users = users.filter((u: any) => !u.teachers || u.teachers.length === 0)
  }

  // Filter by subscription status
  if (options?.subscriptionStatus === 'subscribed') {
    users = users.filter((u: any) =>
      (u.subscriptions || []).some((s: any) => s.status === 'active')
    )
  } else if (options?.subscriptionStatus === 'free') {
    users = users.filter((u: any) =>
      !(u.subscriptions || []).some((s: any) => s.status === 'active')
    )
  }

  // Filter by plan type
  if (options?.planType && options.planType !== 'all') {
    users = users.filter((u: any) =>
      (u.subscriptions || []).some(
        (s: any) => s.status === 'active' && s.plan_type === options.planType
      )
    )
  }

  return { users, total: count }
}

export async function getUserStats() {
  const supabase = await createClient()

  const { data: subscriptions } = await supabase
    .from('subscriptions')
    .select('status, plan_type')

  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })

  const activeSubs = (subscriptions || []).filter(s => s.status === 'active')
  const instrumentCount = activeSubs.filter(s => s.plan_type === 'instrument').length
  const allAccessCount = activeSubs.filter(s => s.plan_type === 'all_access').length
  const totalSubscribers = activeSubs.length
  const freeUsers = (totalUsers || 0) - totalSubscribers
  const mrr = instrumentCount * PLAN_PRICES.instrument + allAccessCount * PLAN_PRICES.all_access

  return {
    totalUsers: totalUsers || 0,
    totalSubscribers,
    instrumentCount,
    allAccessCount,
    freeUsers: Math.max(freeUsers, 0),
    mrr,
  }
}

export async function getUser(userId: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      subscriptions (
        id,
        status,
        plan_type,
        instrument,
        current_period_end,
        stripe_customer_id,
        stripe_subscription_id
      ),
      teachers!teachers_user_id_fkey (
        id,
        name,
        instrument,
        bio
      )
    `)
    .eq('id', userId)
    .single()

  if (error) throw new Error(error.message)

  return data
}

export async function updateUserProfile(userId: string, formData: FormData) {
  const supabase = await createClient()

  const data: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (formData.has('is_admin')) {
    data.is_admin = formData.get('is_admin') === 'true'
  }
  if (formData.has('full_name')) {
    data.full_name = formData.get('full_name') as string
  }

  const { error } = await supabase
    .from('profiles')
    .update(data)
    .eq('id', userId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}

export async function promoteUserToTeacher(userId: string, teacherId: string) {
  const supabase = await createClient()

  // Link the user to the teacher profile
  const { error } = await supabase
    .from('teachers')
    .update({ user_id: userId })
    .eq('id', teacherId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
  revalidatePath('/admin/teachers')
  return { success: true }
}

export async function removeTeacherAccess(teacherId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('teachers')
    .update({ user_id: null })
    .eq('id', teacherId)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/users')
  revalidatePath('/admin/teachers')
  return { success: true }
}

// === TEACHER CRUD ===

export async function createTeacher(formData: FormData) {
  const supabase = await createClient()

  const specialtiesString = formData.get('specialties') as string
  const specialties = specialtiesString
    ? specialtiesString.split(',').map(s => s.trim()).filter(Boolean)
    : null

  const userIdValue = formData.get('user_id') as string

  const data = {
    name: formData.get('name') as string,
    instrument: formData.get('instrument') as string,
    bio: formData.get('bio') as string || null,
    email: formData.get('email') as string || null,
    image_url: formData.get('image_url') as string || null,
    specialties,
    user_id: userIdValue && userIdValue !== '' ? userIdValue : null,
  }

  const { error } = await supabase.from('teachers').insert(data)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/teachers')
  redirect('/admin/teachers')
}

export async function updateTeacher(id: string, formData: FormData) {
  const supabase = await createClient()

  const specialtiesString = formData.get('specialties') as string
  const specialties = specialtiesString
    ? specialtiesString.split(',').map(s => s.trim()).filter(Boolean)
    : null

  const userIdValue = formData.get('user_id') as string

  const data = {
    name: formData.get('name') as string,
    instrument: formData.get('instrument') as string,
    bio: formData.get('bio') as string || null,
    email: formData.get('email') as string || null,
    image_url: formData.get('image_url') as string || null,
    specialties,
    user_id: userIdValue && userIdValue !== '' ? userIdValue : null,
    updated_at: new Date().toISOString(),
  }

  const { error } = await supabase
    .from('teachers')
    .update(data)
    .eq('id', id)

  if (error) throw new Error(error.message)

  revalidatePath('/admin/teachers')
  redirect('/admin/teachers')
}

export async function deleteTeacher(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('teachers').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/teachers')
  return { success: true }
}

// === FINANCIALS ===

export async function getFinancials() {
    const supabase = await createClient()

    // Get all subscriptions
    const { data: subscriptions } = await supabase
      .from('subscriptions')
      .select('id, status, plan_type, instrument, cancel_at_period_end, created_at, current_period_end, user_id, profiles:user_id (full_name, email)')
      .order('created_at', { ascending: false })

    const allSubs = subscriptions || []
    const activeSubs = allSubs.filter(s => s.status === 'active')
    const canceledSubs = allSubs.filter(s => s.status === 'canceled')
    const pastDueSubs = allSubs.filter(s => s.status === 'past_due')
    const pendingCancelSubs = activeSubs.filter(s => s.cancel_at_period_end)

    const instrumentActive = activeSubs.filter(s => s.plan_type === 'instrument').length
    const allAccessActive = activeSubs.filter(s => s.plan_type === 'all_access').length
    const mrr = instrumentActive * PLAN_PRICES.instrument + allAccessActive * PLAN_PRICES.all_access

    // Fetch real revenue from Stripe invoices (last 12 months)
    const stripe = getStripe()
    const now = new Date()
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1)
    const startTimestamp = Math.floor(twelveMonthsAgo.getTime() / 1000)

    let totalStripeRevenue = 0
    const monthlyRevenue: Record<string, number> = {}

    // Initialize all 12 months
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      monthlyRevenue[key] = 0
    }

    try {
      const invoices = await stripe.invoices.list({
        created: { gte: startTimestamp },
        status: 'paid',
        limit: 100,
      })

      for (const invoice of invoices.data) {
        const amount = invoice.amount_paid / 100
        totalStripeRevenue += amount
        const date = new Date(invoice.created * 1000)
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        if (monthlyRevenue[key] !== undefined) {
          monthlyRevenue[key] += amount
        }
      }

      // Paginate if more than 100
      if (invoices.has_more) {
        let lastId = invoices.data[invoices.data.length - 1]?.id
        while (lastId) {
          const more = await stripe.invoices.list({
            created: { gte: startTimestamp },
            status: 'paid',
            limit: 100,
            starting_after: lastId,
          })
          for (const invoice of more.data) {
            const amount = invoice.amount_paid / 100
            totalStripeRevenue += amount
            const date = new Date(invoice.created * 1000)
            const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
            if (monthlyRevenue[key] !== undefined) {
              monthlyRevenue[key] += amount
            }
          }
          if (!more.has_more) break
          lastId = more.data[more.data.length - 1]?.id
        }
      }
    } catch (error) {
      console.error('Failed to fetch Stripe invoices:', error)
    }

    // Churn: canceled in last 30 days
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const recentCanceled = canceledSubs.filter(s => {
      if (!s.current_period_end) return false
      return new Date(s.current_period_end) >= thirtyDaysAgo
    })

    // Recent subscriptions (last 20)
    const recentSubs = allSubs.slice(0, 20).map(s => ({
      id: s.id,
      status: s.status,
      planType: s.plan_type,
      instrument: s.instrument,
      cancelAtPeriodEnd: s.cancel_at_period_end,
      createdAt: s.created_at,
      currentPeriodEnd: s.current_period_end,
      userName: (s.profiles as any)?.full_name || 'Unknown',
      userEmail: (s.profiles as any)?.email || '',
    }))

    return {
      mrr,
      totalRevenue: totalStripeRevenue,
      activeCount: activeSubs.length,
      instrumentActive,
      allAccessActive,
      canceledCount: canceledSubs.length,
      pastDueCount: pastDueSubs.length,
      pendingCancelCount: pendingCancelSubs.length,
      recentChurn: recentCanceled.length,
      monthlyRevenue: Object.entries(monthlyRevenue).map(([month, revenue]) => ({
        month,
        revenue: Math.round(revenue * 100) / 100,
      })),
      recentSubs,
    }
}

// === ANALYTICS ===

export async function getAnalytics() {
  const supabase = await createClient()

  // Course completion data
  const { data: courses } = await supabase
    .from('courses')
    .select(`
      id,
      title,
      lessons (id)
    `)
    .eq('is_published', true)

  // Get all progress data
  const { data: progressData } = await supabase
    .from('user_progress_legacy')
    .select('lesson_id, completed, user_id')

  // Calculate completion rates per course
  const courseCompletionRates = courses?.map(course => {
    const lessonIds = course.lessons?.map((l: { id: string }) => l.id) || []
    const totalLessons = lessonIds.length

    if (totalLessons === 0) return { courseId: course.id, title: course.title, rate: 0, enrollments: 0 }

    // Find users who have started this course
    const usersWithProgress = new Set(
      progressData
        ?.filter(p => p.lesson_id && lessonIds.includes(p.lesson_id))
        .map(p => p.user_id) || []
    )

    // For each user, calculate their completion
    let totalCompletionRate = 0
    usersWithProgress.forEach(userId => {
      const userProgress = progressData?.filter(
        p => p.user_id === userId && p.lesson_id && lessonIds.includes(p.lesson_id) && p.completed
      )
      const completedLessons = userProgress?.length || 0
      totalCompletionRate += completedLessons / totalLessons
    })

    const avgCompletionRate = usersWithProgress.size > 0
      ? (totalCompletionRate / usersWithProgress.size) * 100
      : 0

    return {
      courseId: course.id,
      title: course.title,
      rate: Math.round(avgCompletionRate),
      enrollments: usersWithProgress.size,
    }
  }) || []

  // Popular lessons (most completed)
  const lessonCompletions: Record<string, number> = {}
  progressData?.filter(p => p.completed && p.lesson_id).forEach(p => {
    lessonCompletions[p.lesson_id!] = (lessonCompletions[p.lesson_id!] || 0) + 1
  })

  const { data: lessons } = await supabase
    .from('lessons')
    .select(`
      id,
      title,
      courses (title)
    `)

  const popularLessons = Object.entries(lessonCompletions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([lessonId, count]) => {
      const lesson = lessons?.find(l => l.id === lessonId)
      return {
        lessonId,
        title: lesson?.title || 'Unknown',
        courseTitle: (lesson?.courses as { title: string } | null)?.title || 'Unknown',
        completions: count,
      }
    })

  // User growth (users by month)
  const now = new Date()
  const { data: profiles } = await supabase
    .from('profiles')
    .select('created_at')
    .order('created_at')

  const userGrowth: Record<string, number> = {}
  for (let i = 11; i >= 0; i--) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    userGrowth[key] = 0
  }

  profiles?.forEach(profile => {
    const date = new Date(profile.created_at!)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
    if (userGrowth[key] !== undefined) {
      userGrowth[key] += 1
    }
  })

  // Feedback stats
  const { data: feedbackRequests } = await supabase
    .from('feedback_requests')
    .select('status, created_at, updated_at')

  const feedbackStats = {
    total: feedbackRequests?.length || 0,
    pending: feedbackRequests?.filter(f => f.status === 'pending').length || 0,
    inReview: feedbackRequests?.filter(f => f.status === 'in_review').length || 0,
    completed: feedbackRequests?.filter(f => f.status === 'completed').length || 0,
  }

  return {
    courseCompletionRates,
    popularLessons,
    userGrowth: Object.entries(userGrowth).map(([month, count]) => ({
      month,
      users: count,
    })),
    feedbackStats,
  }
}

// === INSTRUMENTS ===

export async function getInstruments() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('instruments')
    .select(`
      *,
      country:countries(id, name),
      instrument_styles(
        style:musical_styles(id, name)
      )
    `)
    .order('name')

  if (error) throw new Error(error.message)
  return data || []
}

export async function createInstrument(formData: FormData) {
  const supabase = await createClient()

  const countryIdValue = formData.get('country_id') as string

  const data = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: formData.get('description') as string || null,
    image_url: formData.get('image_url') as string || null,
    country_id: countryIdValue && countryIdValue !== '' ? countryIdValue : null,
  }

  const { data: instrument, error } = await supabase
    .from('instruments')
    .insert(data)
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  // Link styles
  const styleIds = (formData.get('style_ids') as string || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (styleIds.length > 0 && instrument) {
    await supabase
      .from('instrument_styles')
      .insert(styleIds.map(style_id => ({ instrument_id: instrument.id, style_id })))
  }

  revalidatePath('/admin/instruments')
  redirect('/admin/instruments')
}

export async function updateInstrument(id: string, formData: FormData) {
  const supabase = await createClient()

  const countryIdValue = formData.get('country_id') as string

  const data = {
    name: formData.get('name') as string,
    slug: formData.get('slug') as string,
    description: formData.get('description') as string || null,
    image_url: formData.get('image_url') as string || null,
    country_id: countryIdValue && countryIdValue !== '' ? countryIdValue : null,
  }

  const { error } = await supabase.from('instruments').update(data).eq('id', id)
  if (error) throw new Error(error.message)

  // Replace styles
  await supabase.from('instrument_styles').delete().eq('instrument_id', id)

  const styleIds = (formData.get('style_ids') as string || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)

  if (styleIds.length > 0) {
    await supabase
      .from('instrument_styles')
      .insert(styleIds.map(style_id => ({ instrument_id: id, style_id })))
  }

  revalidatePath('/admin/instruments')
  redirect('/admin/instruments')
}

export async function deleteInstrument(id: string) {
  const supabase = await createClient()

  const { error } = await supabase.from('instruments').delete().eq('id', id)

  if (error) return { error: error.message }

  revalidatePath('/admin/instruments')
  return { success: true }
}

// === FEEDBACK MANAGEMENT (Admin) ===

export async function getAllFeedbackRequests(status?: string) {
  const supabase = await createClient()

  let query = supabase
    .from('feedback_requests')
    .select(`
      *,
      profiles:user_id (
        id,
        full_name,
        email
      ),
      teachers:teacher_id (
        id,
        name,
        instrument
      )
    `)
    .order('created_at', { ascending: false })

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query

  if (error) throw new Error(error.message)

  return data || []
}
