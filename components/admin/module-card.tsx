'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  GripVertical,
  Video,
  FileQuestion,
  Pencil,
  Trash2,
  HelpCircle,
  ChevronDown,
  Play,
  Eye
} from 'lucide-react'
import { CourseModule } from '@/types/modules'

interface ModuleCardProps {
  module: CourseModule
  index: number
  totalModules: number
  onEdit: (module: CourseModule) => void
  onDelete: (moduleId: string) => void
  showArrow?: boolean
}

export function ModuleCard({
  module,
  index,
  totalModules,
  onEdit,
  onDelete,
  showArrow = true
}: ModuleCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
  } = useSortable({ id: module.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: transition || 'transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
  }

  const getModuleConfig = () => {
    switch (module.module_type) {
      case 'VIDEO':
        return {
          icon: Video,
          color: '#3b82f6',
          bgColor: 'bg-blue-500/10',
          borderColor: 'border-blue-500/30',
          hoverBorderColor: 'hover:border-blue-500/60',
          gradient: 'from-blue-500 to-cyan-500',
          label: 'Video',
        }
      case 'QUIZ':
        return {
          icon: HelpCircle,
          color: '#a855f7',
          bgColor: 'bg-purple-500/10',
          borderColor: 'border-purple-500/30',
          hoverBorderColor: 'hover:border-purple-500/60',
          gradient: 'from-purple-500 to-pink-500',
          label: 'Quiz',
        }
      case 'EXERCISE':
        return {
          icon: FileQuestion,
          color: '#22c55e',
          bgColor: 'bg-green-500/10',
          borderColor: 'border-green-500/30',
          hoverBorderColor: 'hover:border-green-500/60',
          gradient: 'from-green-500 to-emerald-500',
          label: 'Exercise',
        }
    }
  }

  const config = getModuleConfig()
  const Icon = config.icon

  const getQuestionTypeLabel = () => {
    if (!module.question_type) return null
    const labels: Record<string, string> = {
      multiple_choice: 'Multiple Choice',
      text_answer: 'Text Answer',
      audio: 'Audio',
      matching_pairs: 'Matching',
      fill_in_blank: 'Fill in Blank',
      ordering_sequence: 'Ordering',
      true_false: 'True/False',
    }
    return labels[module.question_type] || module.question_type
  }

  const isLast = index === totalModules - 1

  return (
    <div className="relative">
      {/* Module Card */}
      <div
        ref={setNodeRef}
        style={style}
        className={`
          group relative rounded-xl border-2 bg-card
          transition-all duration-200 ease-out
          ${config.borderColor} ${config.hoverBorderColor}
          ${isDragging ? 'shadow-2xl scale-[1.02] z-50 opacity-90' : 'shadow-sm'}
          ${isOver ? 'ring-2 ring-primary ring-offset-2' : ''}
          hover:shadow-md
        `}
      >
        {/* Module number indicator */}
        <div
          className={`
            absolute -left-3 top-1/2 -translate-y-1/2 z-10
            w-6 h-6 rounded-full flex items-center justify-center
            text-xs font-bold text-white
            bg-gradient-to-br ${config.gradient}
            shadow-lg
            transition-transform duration-200
            group-hover:scale-110
          `}
        >
          {index + 1}
        </div>

        <div className="flex items-center gap-3 p-4 pl-6">
          {/* Drag Handle */}
          <button
            {...attributes}
            {...listeners}
            className={`
              p-2 rounded-lg cursor-grab active:cursor-grabbing
              transition-all duration-200
              hover:bg-muted
              ${isDragging ? 'cursor-grabbing bg-muted' : ''}
            `}
          >
            <GripVertical className="w-5 h-5 text-muted-foreground" />
          </button>

          {/* Icon */}
          <div className={`
            p-2.5 rounded-xl ${config.bgColor}
            transition-transform duration-200
            group-hover:scale-110
          `}>
            <Icon className="w-5 h-5" style={{ color: config.color }} />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-foreground truncate">
                {module.title}
              </span>
              <Badge
                variant="outline"
                className={`${config.bgColor} border-transparent text-xs font-medium`}
                style={{ color: config.color }}
              >
                {config.label}
              </Badge>
              {module.question_type && (
                <Badge variant="secondary" className="text-xs">
                  {getQuestionTypeLabel()}
                </Badge>
              )}
              {module.is_free && (
                <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20">
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </Badge>
              )}
            </div>
            {module.description && (
              <p className="text-sm text-muted-foreground truncate mt-1">
                {module.description}
              </p>
            )}
          </div>

          {/* Video preview indicator */}
          {module.module_type === 'VIDEO' && module.video_url && (
            <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-1 rounded-md">
              <Play className="w-3 h-3" />
              <span>Video</span>
            </div>
          )}

          {/* Actions */}
          <div className={`
            flex gap-1
            transition-opacity duration-200
            opacity-0 group-hover:opacity-100
          `}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit(module)}
              className="h-9 w-9 p-0 hover:bg-primary/10 hover:text-primary"
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(module.id)}
              className="h-9 w-9 p-0 hover:bg-destructive/10 hover:text-destructive"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Drag indicator line */}
        {isDragging && (
          <div className="absolute inset-x-0 -bottom-0.5 h-1 rounded-full bg-gradient-to-r from-transparent via-primary to-transparent" />
        )}
      </div>

      {/* Connector Arrow */}
      {showArrow && !isLast && (
        <div className="flex justify-center py-1">
          <div className={`
            flex flex-col items-center gap-0
            transition-all duration-300
            ${isDragging ? 'opacity-0 scale-75' : 'opacity-100 scale-100'}
          `}>
            <div className="w-0.5 h-3 bg-gradient-to-b from-border to-muted-foreground/30 rounded-full" />
            <ChevronDown className="w-4 h-4 text-muted-foreground/50 -mt-1" />
          </div>
        </div>
      )}
    </div>
  )
}

// Drag overlay component for when dragging
export function ModuleCardDragOverlay({ module }: { module: CourseModule }) {
  const getModuleConfig = () => {
    switch (module.module_type) {
      case 'VIDEO':
        return {
          icon: Video,
          color: '#3b82f6',
          bgColor: 'bg-blue-500/10',
          gradient: 'from-blue-500 to-cyan-500',
          label: 'Video',
        }
      case 'QUIZ':
        return {
          icon: HelpCircle,
          color: '#a855f7',
          bgColor: 'bg-purple-500/10',
          gradient: 'from-purple-500 to-pink-500',
          label: 'Quiz',
        }
      case 'EXERCISE':
        return {
          icon: FileQuestion,
          color: '#22c55e',
          bgColor: 'bg-green-500/10',
          gradient: 'from-green-500 to-emerald-500',
          label: 'Exercise',
        }
    }
  }

  const config = getModuleConfig()
  const Icon = config.icon

  return (
    <div className={`
      rounded-xl border-2 border-primary bg-card shadow-2xl
      transform rotate-2 scale-105
      animate-pulse
    `}>
      <div className="flex items-center gap-3 p-4">
        <div className="p-2 rounded-lg bg-muted">
          <GripVertical className="w-5 h-5 text-muted-foreground" />
        </div>
        <div className={`p-2.5 rounded-xl ${config.bgColor}`}>
          <Icon className="w-5 h-5" style={{ color: config.color }} />
        </div>
        <div className="flex-1">
          <span className="font-semibold">{module.title}</span>
          <Badge
            variant="outline"
            className={`ml-2 ${config.bgColor} border-transparent text-xs`}
            style={{ color: config.color }}
          >
            {config.label}
          </Badge>
        </div>
      </div>
    </div>
  )
}
