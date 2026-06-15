'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { ClassItem, ClassItemType } from '@/types/modules'
import {
  createSection,
  updateSection,
  deleteSection,
  reorderSections,
  createClass,
  updateClass,
  deleteClass,
  reorderClasses,
  createClassItem,
  deleteClassItem,
  reorderClassItems,
  updateCourseSettings,
} from '@/app/actions/course-builder'
import styles from './course-studio.module.css'
import { SaveStatusProvider, useSaveStatus } from './save-status'
import { StudioAppBar } from './studio-app-bar'
import { OutlineRail } from './outline-rail'
import { ClassCanvas } from './class-canvas'
import { StudioDrawer } from './studio-drawer'
import { ItemEditor } from './item-editor'
import { CourseSettingsEditor } from './course-settings-editor'
import type {
  ClassWithItems,
  CourseStudioCourse,
  DrawerState,
  MusicalStyleOption,
  SectionWithClasses,
  TeacherOption,
} from './types'

interface CourseStudioProps {
  course: CourseStudioCourse
  musicalStyles: MusicalStyleOption[]
  teachers: TeacherOption[]
  initialSections: SectionWithClasses[]
}

export function CourseStudio(props: CourseStudioProps) {
  return (
    <SaveStatusProvider>
      <StudioWorkspace {...props} />
    </SaveStatusProvider>
  )
}

const DRAWER_WIDTHS = { narrow: 420, wide: 660 } as const

function drawerSizeFor(state: DrawerState, item: ClassItem | null): 'narrow' | 'wide' {
  if (state?.mode === 'item' && (item?.item_type === 'QUIZ' || item?.item_type === 'EXERCISE')) {
    return 'wide'
  }
  return 'narrow'
}

function StudioWorkspace({ course, musicalStyles, teachers, initialSections }: CourseStudioProps) {
  const { track } = useSaveStatus()

  const [sections, setSections] = useState<SectionWithClasses[]>(initialSections)
  const [settings, setSettings] = useState<CourseStudioCourse>(course)
  const [selectedClassId, setSelectedClassId] = useState<string | null>(
    initialSections[0]?.classes[0]?.id ?? null
  )
  const [drawer, setDrawer] = useState<DrawerState>(null)
  // Retained through the close animation so the drawer doesn't empty mid-slide.
  const [lastDrawer, setLastDrawer] = useState<DrawerState>(null)
  const [outlineSheetOpen, setOutlineSheetOpen] = useState(false)

  const openDrawer = useCallback((state: Exclude<DrawerState, null>) => {
    setDrawer(state)
    setLastDrawer(state)
  }, [])
  const closeDrawer = useCallback(() => setDrawer(null), [])

  // Unmount drawer content once the close animation finishes (this also
  // triggers the editors' flush-on-unmount for any pending autosave patch).
  useEffect(() => {
    if (drawer) return
    const timer = setTimeout(() => setLastDrawer(null), 280)
    return () => clearTimeout(timer)
  }, [drawer])

  // ── Derived selection ────────────────────────────────────────────────
  const selected = useMemo(() => {
    for (let si = 0; si < sections.length; si++) {
      const ci = sections[si].classes.findIndex((c) => c.id === selectedClassId)
      if (ci !== -1) {
        return { section: sections[si], cls: sections[si].classes[ci], moduleIndex: si, classIndex: ci }
      }
    }
    return null
  }, [sections, selectedClassId])

  const findItem = useCallback(
    (itemId: string): ClassItem | null => {
      for (const s of sections) {
        for (const c of s.classes) {
          const item = c.items.find((i) => i.id === itemId)
          if (item) return item
        }
      }
      return null
    },
    [sections]
  )

  const renderedDrawer = drawer ?? lastDrawer
  const renderedItem =
    renderedDrawer?.mode === 'item' ? findItem(renderedDrawer.itemId) : null
  const drawerSize = drawerSizeFor(renderedDrawer, renderedItem)

  // ── Module handlers ──────────────────────────────────────────────────
  const handleAddModule = useCallback(
    async (title: string) => {
      const result = await track(createSection(course.id, title))
      if (result.data) {
        setSections((prev) => [...prev, { ...result.data, classes: [] } as SectionWithClasses])
      }
    },
    [course.id, track]
  )

  const handleRenameModule = useCallback(
    (sectionId: string, title: string) => {
      const description = sections.find((s) => s.id === sectionId)?.description
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, title } : s)))
      void track(updateSection(sectionId, title, description ?? undefined))
    },
    [sections, track]
  )

  const handleDeleteModule = useCallback(
    (sectionId: string) => {
      if (!confirm('Delete this module and all its classes? This cannot be undone.')) return
      const removed = sections.find((s) => s.id === sectionId)
      const next = sections.filter((s) => s.id !== sectionId)
      if (removed?.classes.some((c) => c.id === selectedClassId)) {
        setSelectedClassId(next[0]?.classes[0]?.id ?? null)
        setDrawer((d) => (d?.mode === 'item' ? null : d))
      }
      setSections(next)
      void track(deleteSection(sectionId))
    },
    [sections, selectedClassId, track]
  )

  const handleReorderModules = useCallback(
    (next: SectionWithClasses[]) => {
      setSections(next)
      void track(reorderSections(course.id, next.map((s) => s.id)))
    },
    [course.id, track]
  )

  // ── Class handlers ───────────────────────────────────────────────────
  const handleAddClass = useCallback(
    async (sectionId: string, title: string) => {
      const result = await track(createClass(sectionId, title))
      if (result.data) {
        const newClass = { ...result.data, items: [] } as ClassWithItems
        setSections((prev) =>
          prev.map((s) => (s.id === sectionId ? { ...s, classes: [...s.classes, newClass] } : s))
        )
        setSelectedClassId(newClass.id)
      }
    },
    [track]
  )

  const handleUpdateClass = useCallback(
    (classId: string, updates: { title?: string; description?: string; is_free?: boolean }) => {
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          classes: s.classes.map((c) =>
            c.id === classId
              ? {
                  ...c,
                  ...(updates.title !== undefined && { title: updates.title }),
                  ...(updates.description !== undefined && { description: updates.description || null }),
                  ...(updates.is_free !== undefined && { is_free: updates.is_free }),
                }
              : c
          ),
        }))
      )
      void track(updateClass(classId, updates))
    },
    [track]
  )

  const handleDeleteClass = useCallback(
    (classId: string) => {
      if (!confirm('Delete this class and all its items? This cannot be undone.')) return
      const next = sections.map((s) => ({
        ...s,
        classes: s.classes.filter((c) => c.id !== classId),
      }))
      if (selectedClassId === classId) {
        const owner = sections.find((s) => s.classes.some((c) => c.id === classId))
        const ownerNext = next.find((s) => s.id === owner?.id)
        setSelectedClassId(
          ownerNext?.classes[0]?.id ?? next.flatMap((s) => s.classes)[0]?.id ?? null
        )
        setDrawer((d) => (d?.mode === 'item' ? null : d))
      }
      setSections(next)
      void track(deleteClass(classId))
    },
    [sections, selectedClassId, track]
  )

  const handleReorderClasses = useCallback(
    (sectionId: string, classes: ClassWithItems[]) => {
      setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, classes } : s)))
      void track(reorderClasses(sectionId, classes.map((c) => c.id)))
    },
    [track]
  )

  // ── Item handlers ────────────────────────────────────────────────────
  const handleAddItem = useCallback(
    async (classId: string, type: ClassItemType) => {
      const defaultTitles: Record<ClassItemType, string> = {
        VIDEO: 'New Video',
        QUIZ: 'New Quiz',
        EXERCISE: 'New Exercise',
        JAM_SESSION: 'New Jam Session',
      }
      const result = await track(createClassItem(classId, type, defaultTitles[type]))
      if (result.data) {
        const newItem = result.data as ClassItem
        setSections((prev) =>
          prev.map((s) => ({
            ...s,
            classes: s.classes.map((c) =>
              c.id === classId ? { ...c, items: [...c.items, newItem] } : c
            ),
          }))
        )
        openDrawer({ mode: 'item', itemId: newItem.id })
      }
    },
    [openDrawer, track]
  )

  const handleDeleteItem = useCallback(
    (itemId: string) => {
      if (!confirm('Delete this item?')) return
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          classes: s.classes.map((c) => ({
            ...c,
            items: c.items.filter((i) => i.id !== itemId),
          })),
        }))
      )
      setDrawer((d) => (d?.mode === 'item' && d.itemId === itemId ? null : d))
      void track(deleteClassItem(itemId))
    },
    [track]
  )

  const handleReorderItems = useCallback(
    (classId: string, items: ClassItem[]) => {
      setSections((prev) =>
        prev.map((s) => ({
          ...s,
          classes: s.classes.map((c) => (c.id === classId ? { ...c, items } : c)),
        }))
      )
      void track(reorderClassItems(classId, items.map((i) => i.id)))
    },
    [track]
  )

  // Keeps the outline/canvas in sync while the drawer editor autosaves.
  const handleItemPatched = useCallback((itemId: string, patch: Partial<ClassItem>) => {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        classes: s.classes.map((c) => ({
          ...c,
          items: c.items.map((i) => (i.id === itemId ? { ...i, ...patch } : i)),
        })),
      }))
    )
  }, [])

  // ── Course settings ──────────────────────────────────────────────────
  const handleSettingsPatched = useCallback((patch: Partial<CourseStudioCourse>) => {
    setSettings((prev) => ({ ...prev, ...patch }))
  }, [])

  const handleTogglePublish = useCallback(
    (published: boolean) => {
      setSettings((prev) => ({ ...prev, is_published: published }))
      void track(updateCourseSettings(course.id, { is_published: published }))
    },
    [course.id, track]
  )

  const handleSelectClass = useCallback((classId: string) => {
    setSelectedClassId(classId)
    setOutlineSheetOpen(false)
    setDrawer((d) => (d?.mode === 'item' ? null : d))
  }, [])

  const outline = (
    <OutlineRail
      sections={sections}
      selectedClassId={selectedClassId}
      onSelectClass={handleSelectClass}
      onAddModule={handleAddModule}
      onRenameModule={handleRenameModule}
      onDeleteModule={handleDeleteModule}
      onReorderModules={handleReorderModules}
      onAddClass={handleAddClass}
      onReorderClasses={handleReorderClasses}
    />
  )

  return (
    <div
      className={`${styles.studio} flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-background md:h-dvh`}
      data-drawer={drawer ? drawerSize : undefined}
    >
      <StudioAppBar
        title={settings.title}
        isPublished={settings.is_published}
        onTogglePublish={handleTogglePublish}
        settingsOpen={drawer?.mode === 'settings'}
        onToggleSettings={() =>
          drawer?.mode === 'settings' ? closeDrawer() : openDrawer({ mode: 'settings' })
        }
        onOpenOutline={() => setOutlineSheetOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        {/* Outline rail — desktop */}
        <aside
          className={`${styles.scrollHide} hidden w-[300px] flex-shrink-0 flex-col overflow-y-auto border-r border-border bg-warm-surface lg:flex`}
        >
          {outline}
        </aside>

        {/* Class canvas */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          <ClassCanvas
            section={selected?.section ?? null}
            cls={selected?.cls ?? null}
            moduleIndex={selected?.moduleIndex ?? 0}
            classIndex={selected?.classIndex ?? 0}
            hasModules={sections.length > 0}
            activeItemId={drawer?.mode === 'item' ? drawer.itemId : null}
            onUpdateClass={handleUpdateClass}
            onDeleteClass={handleDeleteClass}
            onAddItem={handleAddItem}
            onSelectItem={(itemId) => openDrawer({ mode: 'item', itemId })}
            onDeleteItem={handleDeleteItem}
            onReorderItems={handleReorderItems}
          />
        </main>

        {/* Mobile drawer backdrop */}
        {drawer && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
            onClick={closeDrawer}
          />
        )}

        {/* In-page push drawer */}
        <StudioDrawer
          open={drawer !== null}
          widthPx={DRAWER_WIDTHS[drawerSize]}
          onClose={closeDrawer}
          mode={renderedDrawer?.mode ?? null}
          item={renderedItem}
        >
          {renderedDrawer?.mode === 'settings' && (
            <CourseSettingsEditor
              key={course.id}
              settings={settings}
              musicalStyles={musicalStyles}
              teachers={teachers}
              onPatched={handleSettingsPatched}
            />
          )}
          {renderedDrawer?.mode === 'item' && renderedItem && (
            <ItemEditor
              key={renderedItem.id}
              item={renderedItem}
              onPatched={(patch) => handleItemPatched(renderedItem.id, patch)}
            />
          )}
        </StudioDrawer>
      </div>

      {/* Outline as a sheet below lg */}
      <Sheet open={outlineSheetOpen} onOpenChange={setOutlineSheetOpen}>
        <SheetContent side="left" className="w-[320px] overflow-y-auto bg-warm-surface p-0">
          <SheetTitle className="sr-only">Course outline</SheetTitle>
          {outline}
        </SheetContent>
      </Sheet>
    </div>
  )
}
