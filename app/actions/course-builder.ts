'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { validateCourseKind } from '@/lib/courses/fundamentals'

// ============================================
// Course (settings + creation)
// ============================================

export interface CourseSettingsPatch {
  title?: string
  slug?: string
  description?: string | null
  musical_style_id?: string | null
  is_fundamentals?: boolean
  teacher_id?: string | null
  instrument?: string | null
  is_published?: boolean
  thumbnail_url?: string | null
}

export async function updateCourseSettings(courseId: string, patch: CourseSettingsPatch) {
  const supabase = await createClient()

  const { data: current, error: fetchError } = await supabase
    .from('courses')
    .select('musical_style_id, is_fundamentals, instrument, teacher_id')
    .eq('id', courseId)
    .single()

  if (fetchError || !current) return { error: fetchError?.message || 'Course not found' }

  const updates: Record<string, unknown> = { ...patch }

  // A fundamentals course is genreless by definition.
  const isFundamentals = patch.is_fundamentals ?? current.is_fundamentals ?? false
  if (isFundamentals) updates.musical_style_id = null

  const kind = validateCourseKind({
    isFundamentals,
    musicalStyleId: (updates.musical_style_id !== undefined
      ? updates.musical_style_id
      : current.musical_style_id) as string | null,
    instrument: (updates.instrument !== undefined
      ? updates.instrument
      : current.instrument) as string | null,
  })
  if (!kind.ok) return { error: kind.error }

  if (patch.teacher_id !== undefined) {
    let teacherName = 'Unassigned'
    if (patch.teacher_id) {
      const { data: teacher } = await supabase
        .from('teachers')
        .select('name')
        .eq('id', patch.teacher_id)
        .single()
      if (teacher) teacherName = teacher.name
    }
    updates.teacher_name = teacherName
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await supabase
    .from('courses')
    .update(updates)
    .eq('id', courseId)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/courses')
  revalidatePath(`/admin/courses/${courseId}`)
  return { data }
}

function slugify(title: string) {
  return (
    title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'course'
  )
}

export interface CreateCourseDraftInput {
  title: string
  instrument: string | null
  isFundamentals: boolean
  musicalStyleId: string | null
  teacherId: string | null
}

export async function createCourseDraft(input: CreateCourseDraftInput) {
  const supabase = await createClient()

  const title = input.title.trim()
  if (!title) return { error: 'A course needs a title.' }

  const musicalStyleId = input.isFundamentals ? null : input.musicalStyleId
  const kind = validateCourseKind({
    isFundamentals: input.isFundamentals,
    musicalStyleId,
    instrument: input.instrument,
  })
  if (!kind.ok) return { error: kind.error }

  let teacherName = 'Unassigned'
  if (input.teacherId) {
    const { data: teacher } = await supabase
      .from('teachers')
      .select('name')
      .eq('id', input.teacherId)
      .single()
    if (teacher) teacherName = teacher.name
  }

  const baseSlug = slugify(title)
  for (let attempt = 0; attempt < 5; attempt++) {
    const slug = attempt === 0 ? baseSlug : `${baseSlug}-${attempt + 1}`
    const { data, error } = await supabase
      .from('courses')
      .insert({
        title,
        slug,
        description: null,
        musical_style_id: musicalStyleId,
        is_fundamentals: input.isFundamentals,
        instrument: input.instrument,
        teacher_id: input.teacherId,
        teacher_name: teacherName,
        is_published: false,
      })
      .select('id')
      .single()

    if (!error) {
      revalidatePath('/admin/courses')
      return { data: { id: data.id } }
    }
    // 23505 = unique violation (slug taken) — retry with a numeric suffix.
    if (error.code !== '23505') return { error: error.message }
  }

  return { error: 'Could not find an available slug for this title. Try a different title.' }
}

// ============================================
// Course Sections (Modules)
// ============================================

export async function createSection(courseId: string, title: string, description?: string) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('course_sections')
    .select('order_index')
    .eq('course_id', courseId)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.order_index ?? -1) + 1

  const { data, error } = await supabase
    .from('course_sections')
    .insert({
      course_id: courseId,
      title,
      description: description || null,
      order_index: nextOrder,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath(`/admin/courses/${courseId}`)
  return { data }
}

export async function updateSection(sectionId: string, title: string, description?: string) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('course_sections')
    .update({ title, description: description || null })
    .eq('id', sectionId)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/courses')
  return { data }
}

export async function deleteSection(sectionId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('course_sections')
    .delete()
    .eq('id', sectionId)

  if (error) return { error: error.message }

  revalidatePath('/admin/courses')
  return { success: true }
}

export async function reorderSections(courseId: string, sectionIds: string[]) {
  const supabase = await createClient()

  const updates = sectionIds.map((id, index) =>
    supabase
      .from('course_sections')
      .update({ order_index: index })
      .eq('id', id)
  )

  await Promise.all(updates)

  revalidatePath(`/admin/courses/${courseId}`)
  return { success: true }
}

// ============================================
// Classes
// ============================================

export async function createClass(sectionId: string, title: string, description?: string) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('classes')
    .select('order_index')
    .eq('section_id', sectionId)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.order_index ?? -1) + 1

  const { data, error } = await supabase
    .from('classes')
    .insert({
      section_id: sectionId,
      title,
      description: description || null,
      order_index: nextOrder,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/courses')
  return { data }
}

export async function updateClass(classId: string, updates: { title?: string; description?: string; is_free?: boolean }) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('classes')
    .update({
      ...(updates.title !== undefined && { title: updates.title }),
      ...(updates.description !== undefined && { description: updates.description || null }),
      ...(updates.is_free !== undefined && { is_free: updates.is_free }),
    })
    .eq('id', classId)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/courses')
  return { data }
}

export async function deleteClass(classId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('classes')
    .delete()
    .eq('id', classId)

  if (error) return { error: error.message }

  revalidatePath('/admin/courses')
  return { success: true }
}

export async function reorderClasses(sectionId: string, classIds: string[]) {
  const supabase = await createClient()

  const updates = classIds.map((id, index) =>
    supabase
      .from('classes')
      .update({ order_index: index })
      .eq('id', id)
  )

  await Promise.all(updates)

  revalidatePath('/admin/courses')
  return { success: true }
}

// ============================================
// Class Items
// ============================================

export async function createClassItem(classId: string, itemType: string, title: string) {
  const supabase = await createClient()

  const { data: existing } = await supabase
    .from('class_items')
    .select('order_index')
    .eq('class_id', classId)
    .order('order_index', { ascending: false })
    .limit(1)

  const nextOrder = (existing?.[0]?.order_index ?? -1) + 1

  const { data, error } = await supabase
    .from('class_items')
    .insert({
      class_id: classId,
      item_type: itemType,
      title,
      order_index: nextOrder,
    })
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/courses')
  return { data }
}

export async function updateClassItem(itemId: string, updates: Record<string, unknown>) {
  const supabase = await createClient()

  // Remove undefined values
  const cleanUpdates: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      cleanUpdates[key] = value
    }
  }

  const { data, error } = await supabase
    .from('class_items')
    .update(cleanUpdates)
    .eq('id', itemId)
    .select()
    .single()

  if (error) return { error: error.message }

  revalidatePath('/admin/courses')
  return { data }
}

export async function deleteClassItem(itemId: string) {
  const supabase = await createClient()

  const { error } = await supabase
    .from('class_items')
    .delete()
    .eq('id', itemId)

  if (error) return { error: error.message }

  revalidatePath('/admin/courses')
  return { success: true }
}

export async function reorderClassItems(classId: string, itemIds: string[]) {
  const supabase = await createClient()

  const updates = itemIds.map((id, index) =>
    supabase
      .from('class_items')
      .update({ order_index: index })
      .eq('id', id)
  )

  await Promise.all(updates)

  revalidatePath('/admin/courses')
  return { success: true }
}

// ============================================
// Deep Fetch for Admin
// ============================================

export async function getCourseStructure(courseId: string) {
  const supabase = await createClient()

  const { data: sections, error } = await supabase
    .from('course_sections')
    .select(`
      *,
      classes (
        *,
        items:class_items (*)
      )
    `)
    .eq('course_id', courseId)
    .order('order_index')

  if (error) return { error: error.message }

  // Sort nested arrays by order_index
  const sorted = sections?.map(section => ({
    ...section,
    classes: section.classes
      ?.sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)
      .map((cls: { items?: { order_index: number }[] }) => ({
        ...cls,
        items: cls.items?.sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index) || [],
      })) || [],
  })) || []

  return { data: sorted }
}
