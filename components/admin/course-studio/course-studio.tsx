'use client'

import { useCallback, useState } from 'react'
import { Layers, ListMusic, Settings2 } from 'lucide-react'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import type { ClassItem, ClassItemType } from '@/types/modules'
import {
  createSection,
  deleteSection,
  reorderSections,
  createClass,
  deleteClass,
  reorderClasses,
  createClassItem,
  deleteClassItem,
  reorderClassItems,
  updateCourseSettings,
} from '@/app/actions/course-builder'
import { cn } from '@/lib/utils'
import styles from './course-studio.module.css'
import { SaveStatusProvider, useSaveStatus } from './save-status'
import { StudioAppBar } from './studio-app-bar'
import { OutlineRail } from './outline-rail'
import { ClassCanvas } from './class-canvas'
import { ModuleOverview } from './module-overview'
import { StudioDrawer } from './studio-drawer'
import { ItemEditor } from './item-editor'
import { ModuleEditor } from './module-editor'
import { ClassEditor } from './class-editor'
import { CourseSettingsEditor } from './course-settings-editor'
import { itemMeta } from './item-meta'
import type {
  CenterSelection,
  ClassWithItems,
  CourseStudioCourse,
  DrawerSelection,
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

function StudioWorkspace({ course, musicalStyles, teachers, initialSections }: CourseStudioProps) {
  const { track } = useSaveStatus()

  const [sections, setSections] = useState<SectionWithClasses[]>(initialSections)
  const [settings, setSettings] = useState<CourseStudioCourse>(course)

  // The first class is the most useful landing spot; fall back to the first
  // module, then to course settings.
  const firstClass = initialSections.find((s) => s.classes.length > 0)?.classes[0] ?? null
  const firstModule = initialSections[0] ?? null
  const initialCenter: CenterSelection = firstClass
    ? { type: 'class', id: firstClass.id }
    : firstModule
      ? { type: 'module', id: firstModule.id }
      : null
  const initialDrawer: DrawerSelection = firstClass
    ? { type: 'class', id: firstClass.id }
    : firstModule
      ? { type: 'module', id: firstModule.id }
      : { type: 'course' }

  const [centerSelection, setCenterSelection] = useState<CenterSelection>(initialCenter)
  const [drawerSelection, setDrawerSelection] = useState<DrawerSelection>(initialDrawer)
  const [outlineSheetOpen, setOutlineSheetOpen] = useState(false)
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false)

  const findItem = useCallback(
    (itemId: string): { item: ClassItem; classId: string } | null => {
      for (const s of sections) {
        for (const c of s.classes) {
          const item = c.items.find((i) => i.id === itemId)
          if (item) return { item, classId: c.id }
        }
      }
      return null
    },
    [sections]
  )

  // ── Derived center context (React Compiler memoizes these) ───────────
  const centerModuleId = centerSelection?.type === 'module' ? centerSelection.id : null
  const centerClassId = centerSelection?.type === 'class' ? centerSelection.id : null

  const activeModuleIndex = centerModuleId ? sections.findIndex((s) => s.id === centerModuleId) : -1
  const activeModule =
    activeModuleIndex === -1
      ? null
      : { section: sections[activeModuleIndex], moduleIndex: activeModuleIndex }

  const activeClassModuleIndex = centerClassId
    ? sections.findIndex((s) => s.classes.some((c) => c.id === centerClassId))
    : -1
  const activeClass =
    activeClassModuleIndex === -1 || !centerClassId
      ? null
      : (() => {
          const section = sections[activeClassModuleIndex]
          const classIndex = section.classes.findIndex((c) => c.id === centerClassId)
          return { section, cls: section.classes[classIndex], moduleIndex: activeClassModuleIndex, classIndex }
        })()

  // ── Derived drawer entity ────────────────────────────────────────────
  const drawerItem =
    drawerSelection.type === 'item' ? (findItem(drawerSelection.id)?.item ?? null) : null

  const drawerSize =
    drawerItem && (drawerItem.item_type === 'QUIZ' || drawerItem.item_type === 'EXERCISE')
      ? 'wide'
      : 'narrow'

  // ── Selection handlers ───────────────────────────────────────────────
  const handleSelectModule = useCallback((sectionId: string) => {
    setCenterSelection({ type: 'module', id: sectionId })
    setDrawerSelection({ type: 'module', id: sectionId })
    setOutlineSheetOpen(false)
  }, [])

  const handleSelectClass = useCallback((classId: string) => {
    setCenterSelection({ type: 'class', id: classId })
    setDrawerSelection({ type: 'class', id: classId })
    setOutlineSheetOpen(false)
  }, [])

  const handleSelectItem = useCallback((itemId: string) => {
    setDrawerSelection({ type: 'item', id: itemId })
    setMobileDrawerOpen(true)
  }, [])

  const handleSelectCourse = useCallback(() => {
    setDrawerSelection({ type: 'course' })
    setMobileDrawerOpen(true)
  }, [])

  // ── Module handlers ──────────────────────────────────────────────────
  const handleAddModule = useCallback(
    async (title: string) => {
      const result = await track(createSection(course.id, title))
      if (result.data) {
        setSections((prev) => [...prev, { ...result.data, classes: [] } as SectionWithClasses])
        handleSelectModule(result.data.id)
      }
    },
    [course.id, track, handleSelectModule]
  )

  const handlePatchModule = useCallback((sectionId: string, patch: Partial<SectionWithClasses>) => {
    setSections((prev) => prev.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)))
  }, [])

  const handleDeleteModule = useCallback(
    (sectionId: string) => {
      if (!confirm('Delete this module and all its classes? This cannot be undone.')) return
      const next = sections.filter((s) => s.id !== sectionId)
      setSections(next)

      const fallbackClass = next.find((s) => s.classes.length > 0)?.classes[0] ?? null
      const fallbackCenter: CenterSelection = fallbackClass
        ? { type: 'class', id: fallbackClass.id }
        : next[0]
          ? { type: 'module', id: next[0].id }
          : null
      const removedItemIds = new Set(
        sections.find((s) => s.id === sectionId)?.classes.flatMap((c) => c.items.map((i) => i.id)) ?? []
      )
      const removedClassIds = new Set(
        sections.find((s) => s.id === sectionId)?.classes.map((c) => c.id) ?? []
      )

      setCenterSelection((cur) => {
        if (cur?.type === 'module' && cur.id === sectionId) return fallbackCenter
        if (cur?.type === 'class' && removedClassIds.has(cur.id)) return fallbackCenter
        return cur
      })
      setDrawerSelection((cur) => {
        if (cur.type === 'module' && cur.id === sectionId) return fallbackCenter ?? { type: 'course' }
        if (cur.type === 'class' && removedClassIds.has(cur.id)) return fallbackCenter ?? { type: 'course' }
        if (cur.type === 'item' && removedItemIds.has(cur.id)) return fallbackCenter ?? { type: 'course' }
        return cur
      })

      void track(deleteSection(sectionId))
    },
    [sections, track]
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
        handleSelectClass(newClass.id)
      }
    },
    [track, handleSelectClass]
  )

  const handlePatchClass = useCallback((classId: string, patch: Partial<ClassWithItems>) => {
    setSections((prev) =>
      prev.map((s) => ({
        ...s,
        classes: s.classes.map((c) => (c.id === classId ? { ...c, ...patch } : c)),
      }))
    )
  }, [])

  const handleDeleteClass = useCallback(
    (classId: string) => {
      if (!confirm('Delete this class and all its items? This cannot be undone.')) return
      const owner = sections.find((s) => s.classes.some((c) => c.id === classId))
      const removedItemIds = new Set(
        owner?.classes.find((c) => c.id === classId)?.items.map((i) => i.id) ?? []
      )
      const next = sections.map((s) => ({
        ...s,
        classes: s.classes.filter((c) => c.id !== classId),
      }))
      setSections(next)

      const ownerNext = next.find((s) => s.id === owner?.id)
      const fallbackClass =
        ownerNext?.classes[0] ?? next.flatMap((s) => s.classes)[0] ?? null
      const fallbackCenter: CenterSelection = fallbackClass
        ? { type: 'class', id: fallbackClass.id }
        : owner
          ? { type: 'module', id: owner.id }
          : null

      setCenterSelection((cur) =>
        cur?.type === 'class' && cur.id === classId ? fallbackCenter : cur
      )
      setDrawerSelection((cur) => {
        if (cur.type === 'class' && cur.id === classId) return fallbackCenter ?? { type: 'course' }
        if (cur.type === 'item' && removedItemIds.has(cur.id)) return fallbackCenter ?? { type: 'course' }
        return cur
      })

      void track(deleteClass(classId))
    },
    [sections, track]
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
        handleSelectItem(newItem.id)
      }
    },
    [track, handleSelectItem]
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
      setDrawerSelection((cur) => {
        if (cur.type === 'item' && cur.id === itemId) {
          return centerSelection?.type === 'class'
            ? { type: 'class', id: centerSelection.id }
            : { type: 'course' }
        }
        return cur
      })
      void track(deleteClassItem(itemId))
    },
    [track, centerSelection]
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

  // Keeps the outline/center in sync while the drawer item editor autosaves.
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

  const outline = (
    <OutlineRail
      sections={sections}
      selectedClassId={centerSelection?.type === 'class' ? centerSelection.id : null}
      selectedModuleId={drawerSelection.type === 'module' ? drawerSelection.id : null}
      onSelectClass={handleSelectClass}
      onSelectModule={handleSelectModule}
      onAddModule={handleAddModule}
      onDeleteModule={handleDeleteModule}
      onReorderModules={handleReorderModules}
      onAddClass={handleAddClass}
      onReorderClasses={handleReorderClasses}
    />
  )

  // ── Drawer header + body by selection ────────────────────────────────
  const drawerModule =
    drawerSelection.type === 'module'
      ? sections.find((s) => s.id === drawerSelection.id) ?? null
      : null
  const drawerClass =
    drawerSelection.type === 'class'
      ? sections.flatMap((s) => s.classes).find((c) => c.id === drawerSelection.id) ?? null
      : null

  let drawerHeader: { label?: string; title: string; icon: React.ReactNode }
  let drawerBody: React.ReactNode

  if (drawerSelection.type === 'course') {
    drawerHeader = {
      title: 'Course settings',
      icon: (
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Settings2 className="h-3.5 w-3.5" />
        </span>
      ),
    }
    drawerBody = (
      <CourseSettingsEditor
        key={course.id}
        settings={settings}
        musicalStyles={musicalStyles}
        teachers={teachers}
        onPatched={handleSettingsPatched}
      />
    )
  } else if (drawerSelection.type === 'module' && drawerModule) {
    drawerHeader = {
      label: 'Module',
      title: drawerModule.title || 'Untitled module',
      icon: (
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-gold/10 text-gold">
          <Layers className="h-3.5 w-3.5" />
        </span>
      ),
    }
    drawerBody = (
      <ModuleEditor
        key={drawerModule.id}
        section={drawerModule}
        onPatched={(patch) => handlePatchModule(drawerModule.id, patch)}
        onDelete={() => handleDeleteModule(drawerModule.id)}
      />
    )
  } else if (drawerSelection.type === 'class' && drawerClass) {
    drawerHeader = {
      label: 'Class',
      title: drawerClass.title || 'Untitled class',
      icon: (
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <ListMusic className="h-3.5 w-3.5" />
        </span>
      ),
    }
    drawerBody = (
      <ClassEditor
        key={drawerClass.id}
        cls={drawerClass}
        onPatched={(patch) => handlePatchClass(drawerClass.id, patch)}
        onDelete={() => handleDeleteClass(drawerClass.id)}
      />
    )
  } else if (drawerSelection.type === 'item' && drawerItem) {
    const meta = itemMeta(drawerItem.item_type)
    const Icon = meta.icon
    drawerHeader = {
      label: meta.label,
      title: drawerItem.title || 'Untitled',
      icon: (
        <span
          className={cn(
            'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg',
            meta.bg,
            meta.fg
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      ),
    }
    drawerBody = (
      <ItemEditor
        key={drawerItem.id}
        item={drawerItem}
        onPatched={(patch) => handleItemPatched(drawerItem.id, patch)}
      />
    )
  } else {
    // Nothing resolvable (e.g. mid-delete) — show a neutral placeholder.
    drawerHeader = {
      title: 'Inspector',
      icon: (
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-muted/40 text-muted-foreground">
          <Settings2 className="h-3.5 w-3.5" />
        </span>
      ),
    }
    drawerBody = (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-muted-foreground">
        Select a module, class, or item to edit.
      </div>
    )
  }

  return (
    <div
      className={`${styles.studio} flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-background md:h-dvh`}
      data-drawer={drawerSize}
      data-mobile-drawer={mobileDrawerOpen ? 'open' : undefined}
    >
      <StudioAppBar
        title={settings.title}
        isPublished={settings.is_published}
        courseSelected={drawerSelection.type === 'course'}
        onTogglePublish={handleTogglePublish}
        onSelectCourse={handleSelectCourse}
        onOpenOutline={() => setOutlineSheetOpen(true)}
        onOpenDrawer={() => setMobileDrawerOpen(true)}
      />

      <div className="flex min-h-0 flex-1">
        {/* Outline rail — desktop */}
        <aside
          className={`${styles.scrollHide} hidden w-[300px] flex-shrink-0 flex-col overflow-y-auto border-r border-border bg-warm-surface lg:flex`}
        >
          {outline}
        </aside>

        {/* Center */}
        <main className="min-w-0 flex-1 overflow-y-auto">
          {activeClass ? (
            <ClassCanvas
              section={activeClass.section}
              cls={activeClass.cls}
              moduleIndex={activeClass.moduleIndex}
              classIndex={activeClass.classIndex}
              hasModules={sections.length > 0}
              activeItemId={drawerSelection.type === 'item' ? drawerSelection.id : null}
              onAddItem={handleAddItem}
              onSelectItem={handleSelectItem}
              onDeleteItem={handleDeleteItem}
              onReorderItems={handleReorderItems}
            />
          ) : activeModule ? (
            <ModuleOverview
              section={activeModule.section}
              moduleIndex={activeModule.moduleIndex}
              onSelectClass={handleSelectClass}
              onAddClass={(title) => handleAddClass(activeModule.section.id, title)}
            />
          ) : (
            <ClassCanvas
              section={null}
              cls={null}
              moduleIndex={0}
              classIndex={0}
              hasModules={sections.length > 0}
              activeItemId={null}
              onAddItem={handleAddItem}
              onSelectItem={handleSelectItem}
              onDeleteItem={handleDeleteItem}
              onReorderItems={handleReorderItems}
            />
          )}
        </main>

        {/* Mobile drawer backdrop */}
        {mobileDrawerOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
            onClick={() => setMobileDrawerOpen(false)}
          />
        )}

        {/* Always-open inspector drawer */}
        <StudioDrawer
          widthPx={DRAWER_WIDTHS[drawerSize]}
          header={drawerHeader}
          onMobileClose={() => setMobileDrawerOpen(false)}
        >
          {drawerBody}
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
