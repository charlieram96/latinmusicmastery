'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Sparkles, Video, HelpCircle, FileQuestion, Music } from 'lucide-react'
import { ModuleAccordionList } from './module-accordion-list'
import { ClassEditorDialog } from './class-editor-dialog'
import { ClassItemEditorPanel } from './class-item-editor-panel'
import {
  CourseSection,
  ClassRecord,
  ClassItem,
  ClassItemType,
} from '@/types/modules'
import {
  createSection,
  deleteSection,
  updateSection,
  createClass,
  updateClass,
  deleteClass,
  createClassItem,
  deleteClassItem,
} from '@/app/actions/course-builder'

export interface ClassWithItems extends ClassRecord {
  items: ClassItem[]
}

export interface SectionWithClasses extends CourseSection {
  classes: ClassWithItems[]
}

interface CourseBuilderV2Props {
  courseId: string
  initialSections: SectionWithClasses[]
}

export function CourseBuilderV2({ courseId, initialSections }: CourseBuilderV2Props) {
  const [sections, setSections] = useState<SectionWithClasses[]>(initialSections)

  // Dialog states
  const [classDialog, setClassDialog] = useState<{
    isOpen: boolean
    mode: 'create' | 'edit'
    sectionId?: string
    classRecord?: ClassRecord
  }>({ isOpen: false, mode: 'create' })

  const [sectionDialog, setSectionDialog] = useState<{
    isOpen: boolean
    mode: 'create' | 'edit'
    section?: CourseSection
  }>({ isOpen: false, mode: 'create' })

  // Item editor panel
  const [editingItem, setEditingItem] = useState<ClassItem | null>(null)
  const [isItemPanelOpen, setIsItemPanelOpen] = useState(false)

  // === Section handlers ===
  const handleAddSection = useCallback(() => {
    setSectionDialog({ isOpen: true, mode: 'create' })
  }, [])

  const handleEditSection = useCallback((section: CourseSection) => {
    setSectionDialog({ isOpen: true, mode: 'edit', section })
  }, [])

  const handleSaveSection = useCallback(async (title: string, description: string) => {
    if (sectionDialog.mode === 'create') {
      const result = await createSection(courseId, title, description)
      if (result.data) {
        const newSection: SectionWithClasses = { ...(result.data as CourseSection), classes: [] }
        setSections(prev => [...prev, newSection])
      }
    } else if (sectionDialog.section) {
      const result = await updateSection(sectionDialog.section.id, title, description)
      if (result.data) {
        const { id, title: t, description: d, order_index, course_id, created_at, updated_at } = result.data
        setSections(prev =>
          prev.map(s => s.id === id ? { ...s, title: t, description: d, order_index, course_id, created_at, updated_at } : s)
        )
      }
    }
  }, [courseId, sectionDialog])

  const handleDeleteSection = useCallback(async (sectionId: string) => {
    if (!confirm('Delete this module and all its classes? This cannot be undone.')) return
    const result = await deleteSection(sectionId)
    if (result.success) {
      setSections(prev => prev.filter(s => s.id !== sectionId))
    }
  }, [])

  // === Class handlers ===
  const handleAddClass = useCallback((sectionId: string) => {
    setClassDialog({ isOpen: true, mode: 'create', sectionId })
  }, [])

  const handleEditClass = useCallback((cls: ClassRecord) => {
    setClassDialog({ isOpen: true, mode: 'edit', classRecord: cls })
  }, [])

  const handleSaveClass = useCallback(async (title: string, description: string) => {
    if (classDialog.mode === 'create' && classDialog.sectionId) {
      const result = await createClass(classDialog.sectionId, title, description)
      if (result.error) {
        console.error('Failed to create class:', result.error)
      }
      if (result.data) {
        const newClass: ClassWithItems = { ...(result.data as ClassRecord), items: [] }
        setSections(prev =>
          prev.map(s =>
            s.id === classDialog.sectionId
              ? { ...s, classes: [...s.classes, newClass] }
              : s
          ) as SectionWithClasses[]
        )
      }
    } else if (classDialog.classRecord) {
      const result = await updateClass(classDialog.classRecord.id, { title, description })
      if (result.data) {
        const { id: updId, title: t, description: d } = result.data
        setSections(prev =>
          prev.map(s => ({
            ...s,
            classes: s.classes.map(c =>
              c.id === updId ? { ...c, title: t, description: d } : c
            ),
          })) as SectionWithClasses[]
        )
      }
    }
  }, [classDialog])

  const handleDeleteClass = useCallback(async (classId: string) => {
    if (!confirm('Delete this class and all its items? This cannot be undone.')) return
    const result = await deleteClass(classId)
    if (result.success) {
      setSections(prev =>
        prev.map(s => ({
          ...s,
          classes: s.classes.filter(c => c.id !== classId),
        })) as SectionWithClasses[]
      )
    }
  }, [])

  const handleClassesChange = useCallback((sectionId: string, classes: ClassWithItems[]) => {
    setSections(prev =>
      prev.map(s => s.id === sectionId ? { ...s, classes } : s)
    )
  }, [])

  // === Item handlers ===
  const handleAddItem = useCallback(async (classId: string, type: ClassItemType) => {
    const defaultTitles: Record<ClassItemType, string> = {
      VIDEO: 'New Video',
      QUIZ: 'New Quiz',
      EXERCISE: 'New Exercise',
      JAM_SESSION: 'New Jam Session',
    }
    const result = await createClassItem(classId, type, defaultTitles[type])
    if (result.data) {
      const newItem = result.data as ClassItem
      setSections(prev =>
        prev.map(s => ({
          ...s,
          classes: s.classes.map(c =>
            c.id === classId
              ? { ...c, items: [...(c.items || []), newItem] }
              : c
          ),
        })) as SectionWithClasses[]
      )
      setEditingItem(newItem)
      setIsItemPanelOpen(true)
    }
  }, [])

  const handleEditItem = useCallback((item: ClassItem) => {
    setEditingItem(item)
    setIsItemPanelOpen(true)
  }, [])

  const handleDeleteItem = useCallback(async (itemId: string) => {
    if (!confirm('Delete this item?')) return
    const result = await deleteClassItem(itemId)
    if (result.success) {
      setSections(prev =>
        prev.map(s => ({
          ...s,
          classes: s.classes.map(c => ({
            ...c,
            items: (c.items || []).filter(i => i.id !== itemId),
          })),
        })) as SectionWithClasses[]
      )
    }
  }, [])

  const handleItemSaved = useCallback((savedItem: ClassItem) => {
    setSections(prev =>
      prev.map(s => ({
        ...s,
        classes: s.classes.map(c => ({
          ...c,
          items: (c.items || []).map(i => i.id === savedItem.id ? savedItem : i),
        })),
      })) as SectionWithClasses[]
    )
  }, [])

  const handleItemsChange = useCallback((classId: string, items: ClassItem[]) => {
    setSections(prev =>
      prev.map(s => ({
        ...s,
        classes: s.classes.map(c =>
          c.id === classId ? { ...c, items } : c
        ),
      })) as SectionWithClasses[]
    )
  }, [])

  // Count stats
  const allItems = sections.flatMap(s => s.classes.flatMap(c => c.items || []))
  const videoCount = allItems.filter(i => i.item_type === 'VIDEO').length
  const quizCount = allItems.filter(i => i.item_type === 'QUIZ').length
  const exerciseCount = allItems.filter(i => i.item_type === 'EXERCISE').length
  const jamCount = allItems.filter(i => i.item_type === 'JAM_SESSION').length

  return (
    <div className="space-y-6">
      {/* Stats Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl">Course Builder</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {sections.length} module{sections.length !== 1 ? 's' : ''} •{' '}
                  {sections.reduce((acc, s) => acc + s.classes.length, 0)} class{sections.reduce((acc, s) => acc + s.classes.length, 0) !== 1 ? 'es' : ''} •{' '}
                  {allItems.length} item{allItems.length !== 1 ? 's' : ''}
                </p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {videoCount > 0 && (
                <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                  <Video className="w-3 h-3 mr-1" /> {videoCount}
                </Badge>
              )}
              {quizCount > 0 && (
                <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                  <HelpCircle className="w-3 h-3 mr-1" /> {quizCount}
                </Badge>
              )}
              {exerciseCount > 0 && (
                <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                  <FileQuestion className="w-3 h-3 mr-1" /> {exerciseCount}
                </Badge>
              )}
              {jamCount > 0 && (
                <Badge variant="secondary" className="text-xs bg-orange-500/10 text-orange-600 border-orange-500/20">
                  <Music className="w-3 h-3 mr-1" /> {jamCount}
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Module Accordion List */}
      <Card>
        <CardContent className="p-6">
          <ModuleAccordionList
            courseId={courseId}
            sections={sections}
            onSectionsChange={setSections}
            onAddSection={handleAddSection}
            onEditSection={handleEditSection}
            onDeleteSection={handleDeleteSection}
            onAddClass={handleAddClass}
            onEditClass={handleEditClass}
            onDeleteClass={handleDeleteClass}
            onClassesChange={handleClassesChange}
            onEditItem={handleEditItem}
            onDeleteItem={handleDeleteItem}
            onAddItem={handleAddItem}
            onItemsChange={handleItemsChange}
          />
        </CardContent>
      </Card>

      {/* Section (Module) Editor Dialog */}
      <ClassEditorDialog
        isOpen={sectionDialog.isOpen}
        onClose={() => setSectionDialog({ isOpen: false, mode: 'create' })}
        onSave={handleSaveSection}
        initialTitle={sectionDialog.section?.title}
        initialDescription={sectionDialog.section?.description || ''}
        mode={sectionDialog.mode}
      />

      {/* Class Editor Dialog */}
      <ClassEditorDialog
        isOpen={classDialog.isOpen}
        onClose={() => setClassDialog({ isOpen: false, mode: 'create' })}
        onSave={handleSaveClass}
        initialTitle={classDialog.classRecord?.title}
        initialDescription={classDialog.classRecord?.description || ''}
        mode={classDialog.mode}
      />

      {/* Item Editor Panel (Sheet) */}
      <ClassItemEditorPanel
        item={editingItem}
        isOpen={isItemPanelOpen}
        onClose={() => {
          setIsItemPanelOpen(false)
          setEditingItem(null)
        }}
        onSaved={handleItemSaved}
      />
    </div>
  )
}
