'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  GripVertical,
  ChevronDown,
  Pencil,
  Trash2,
  Layers,
  BookOpen,
} from 'lucide-react'
import { ClassList } from './class-list'
import type {
  CourseSection,
  ClassRecord,
  ClassItem,
  ClassItemType,
} from '@/types/modules'

interface ModuleAccordionItemProps {
  section: CourseSection & { classes: (ClassRecord & { items: ClassItem[] })[] }
  onEditSection: (section: CourseSection) => void
  onDeleteSection: (sectionId: string) => void
  onAddClass: (sectionId: string) => void
  onEditClass: (cls: ClassRecord) => void
  onDeleteClass: (classId: string) => void
  onClassesChange: (sectionId: string, classes: (ClassRecord & { items: ClassItem[] })[]) => void
  onEditItem: (item: ClassItem) => void
  onDeleteItem: (itemId: string) => void
  onAddItem: (classId: string, type: ClassItemType) => void
  onItemsChange: (classId: string, items: ClassItem[]) => void
}

export function ModuleAccordionItem({
  section,
  onEditSection,
  onDeleteSection,
  onAddClass,
  onEditClass,
  onDeleteClass,
  onClassesChange,
  onEditItem,
  onDeleteItem,
  onAddItem,
  onItemsChange,
}: ModuleAccordionItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: section.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`
        transition-opacity duration-200
        ${isDragging ? 'opacity-50' : 'opacity-100'}
      `}
    >
      <AccordionItem value={section.id} className="border rounded-xl mb-3 bg-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className="p-1.5 rounded-lg cursor-grab active:cursor-grabbing transition-colors hover:bg-muted"
          >
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Purple icon circle */}
          <div className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-500/10">
            <Layers className="w-4 h-4 text-purple-500" />
          </div>

          {/* Section title + badge - wrapped in AccordionTrigger for expand/collapse */}
          <AccordionTrigger className="flex-1 py-0 hover:no-underline gap-3 [&>svg]:hidden">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <span className="font-semibold text-base text-foreground truncate">
                {section.title}
              </span>
              <Badge
                variant="secondary"
                className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20 shrink-0"
              >
                <BookOpen className="w-3 h-3 mr-1" />
                {section.classes.length} {section.classes.length === 1 ? 'class' : 'classes'}
              </Badge>
            </div>
          </AccordionTrigger>

          {/* Action buttons */}
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onEditSection(section)
              }}
              className="h-8 w-8 p-0 hover:bg-primary/10 hover:text-primary"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteSection(section.id)
              }}
              className="h-8 w-8 p-0 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Chevron indicator */}
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-200" />
        </div>

        {/* Collapsible content */}
        <AccordionContent className="px-4 pb-4 pt-0">
          <ClassList
            sectionId={section.id}
            classes={section.classes}
            onClassesChange={(classes) => onClassesChange(section.id, classes)}
            onAddClass={() => onAddClass(section.id)}
            onEditClass={onEditClass}
            onDeleteClass={onDeleteClass}
            onEditItem={onEditItem}
            onDeleteItem={onDeleteItem}
            onAddItem={onAddItem}
            onItemsChange={onItemsChange}
          />
        </AccordionContent>
      </AccordionItem>
    </div>
  )
}

// Drag overlay - shows just the header for visual feedback
export function ModuleAccordionDragOverlay({
  section,
}: {
  section: CourseSection & { classes: (ClassRecord & { items: ClassItem[] })[] }
}) {
  return (
    <div className="rounded-xl border-2 border-primary bg-card shadow-2xl transform rotate-1 scale-105 animate-pulse">
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="p-1.5 rounded-lg bg-muted">
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className="flex items-center justify-center w-9 h-9 rounded-full bg-purple-500/10">
          <Layers className="w-4 h-4 text-purple-500" />
        </div>
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <span className="font-semibold text-base text-foreground truncate">
            {section.title}
          </span>
          <Badge
            variant="secondary"
            className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20 shrink-0"
          >
            <BookOpen className="w-3 h-3 mr-1" />
            {section.classes.length} {section.classes.length === 1 ? 'class' : 'classes'}
          </Badge>
        </div>
      </div>
    </div>
  )
}
