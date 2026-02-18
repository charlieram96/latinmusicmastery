'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

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
