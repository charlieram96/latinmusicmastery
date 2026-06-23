'use server'

import { createClient } from '@/lib/supabase/server'
import { getServerLocale } from '@/lib/i18n/server'
import { localizeSectionTree } from '@/lib/i18n/localize'

export async function getCourseStructureForStudent(courseId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return { error: 'Not authenticated' }

  // Fetch sections with classes and items
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

  // Localize the whole tree to the viewer's language before processing.
  const locale = await getServerLocale()
  localizeSectionTree(sections, locale)

  // Sort nested arrays
  const sorted = sections?.map(section => ({
    ...section,
    classes: section.classes
      ?.sort((a: any, b: any) => a.order_index - b.order_index)
      .map((cls: any) => ({
        ...cls,
        items: cls.items?.sort((a: any, b: any) => a.order_index - b.order_index) || [],
      })) || [],
  })) || []

  // Collect all item IDs
  const allItemIds: string[] = []
  for (const section of sorted) {
    for (const cls of section.classes) {
      for (const item of cls.items) {
        allItemIds.push(item.id)
      }
    }
  }

  // Fetch progress
  let progressMap: Record<string, { completed: boolean; last_position_seconds: number | null }> = {}
  if (allItemIds.length > 0) {
    const { data: progress } = await supabase
      .from('class_item_progress')
      .select('*')
      .eq('user_id', user.id)
      .in('class_item_id', allItemIds)

    for (const p of progress || []) {
      progressMap[p.class_item_id] = {
        completed: p.completed ?? false,
        last_position_seconds: p.last_position_seconds,
      }
    }
  }

  // Enrich with progress
  let totalItems = 0
  let completedItems = 0
  let totalDurationSeconds = 0
  let completedDurationSeconds = 0
  let nextClassId: string | null = null

  const enrichedSections = sorted.map(section => {
    let sectionTotalItems = 0
    let sectionCompletedItems = 0

    const enrichedClasses = section.classes.map((cls: any) => {
      let classTotalItems = cls.items.length
      let classCompletedItems = 0
      const completedItemIds: string[] = []

      for (const item of cls.items) {
        const prog = progressMap[item.id]
        if (prog?.completed) {
          classCompletedItems++
          completedItemIds.push(item.id)
        }
        if (item.item_type === 'VIDEO' && item.video_duration_seconds) {
          totalDurationSeconds += item.video_duration_seconds
          if (prog?.completed) {
            completedDurationSeconds += item.video_duration_seconds
          }
        }
      }

      sectionTotalItems += classTotalItems
      sectionCompletedItems += classCompletedItems

      // Find next class to continue
      if (!nextClassId && classCompletedItems < classTotalItems) {
        nextClassId = cls.id
      }

      return {
        ...cls,
        totalItems: classTotalItems,
        completedItems: classCompletedItems,
        completedItemIds,
      }
    })

    totalItems += sectionTotalItems
    completedItems += sectionCompletedItems

    return {
      ...section,
      classes: enrichedClasses,
      totalItems: sectionTotalItems,
      completedItems: sectionCompletedItems,
    }
  })

  return {
    data: {
      sections: enrichedSections,
      totalItems,
      completedItems,
      totalDurationSeconds,
      completedDurationSeconds,
      nextClassId,
      progressMap,
    },
  }
}
