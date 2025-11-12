'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

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
    return { error: error.message }
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
    return { error: error.message }
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
    return { error: error.message }
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
    return { error: error.message }
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
    return { error: error.message }
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
    return { error: error.message }
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
    return { error: error.message }
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
    return { error: error.message }
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
    return { error: error.message }
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
    return { error: error.message }
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
