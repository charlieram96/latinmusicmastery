'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Video, FileQuestion, HelpCircle, Plus, Sparkles } from 'lucide-react'
import { ModuleList } from './module-list'
import { ModuleEditorDialog } from './module-editor-dialog'
import { CourseModule, ModuleType } from '@/types/modules'
import { createClient } from '@/lib/supabase/client'

interface CourseBuilderProps {
  courseId: string
  initialModules: CourseModule[]
}

const moduleTypes = [
  {
    type: 'VIDEO' as ModuleType,
    label: 'Video Lesson',
    description: 'Upload a teaching video',
    icon: Video,
    gradient: 'from-blue-500 to-cyan-500',
    bgGradient: 'from-blue-500/10 to-cyan-500/10',
    borderColor: 'border-blue-500/30 hover:border-blue-500/60',
    iconBg: 'bg-blue-500/20',
  },
  {
    type: 'QUIZ' as ModuleType,
    label: 'Quiz',
    description: 'Test student knowledge',
    icon: HelpCircle,
    gradient: 'from-purple-500 to-pink-500',
    bgGradient: 'from-purple-500/10 to-pink-500/10',
    borderColor: 'border-purple-500/30 hover:border-purple-500/60',
    iconBg: 'bg-purple-500/20',
  },
  {
    type: 'EXERCISE' as ModuleType,
    label: 'Exercise',
    description: 'Practice activity',
    icon: FileQuestion,
    gradient: 'from-green-500 to-emerald-500',
    bgGradient: 'from-green-500/10 to-emerald-500/10',
    borderColor: 'border-green-500/30 hover:border-green-500/60',
    iconBg: 'bg-green-500/20',
  },
]

export function CourseBuilder({ courseId, initialModules }: CourseBuilderProps) {
  const [modules, setModules] = useState(initialModules)
  const [editingModule, setEditingModule] = useState<Partial<CourseModule> | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [hoveredType, setHoveredType] = useState<ModuleType | null>(null)

  const handleAddModule = (type: ModuleType) => {
    setEditingModule({ module_type: type })
    setIsDialogOpen(true)
  }

  const handleEditModule = (module: CourseModule) => {
    setEditingModule(module)
    setIsDialogOpen(true)
  }

  const handleDeleteModule = async (moduleId: string) => {
    if (!confirm('Are you sure you want to delete this module?')) return

    const supabase = createClient()
    const { error } = await supabase
      .from('course_modules')
      .delete()
      .eq('id', moduleId)

    if (!error) {
      setModules(modules.filter((m) => m.id !== moduleId))
    }
  }

  const handleSaveModule = (savedModule: CourseModule) => {
    if (editingModule?.id) {
      setModules(modules.map((m) => (m.id === savedModule.id ? savedModule : m)))
    } else {
      setModules([...modules, savedModule])
    }
    setEditingModule(null)
  }

  const handleCloseDialog = () => {
    setIsDialogOpen(false)
    setEditingModule(null)
  }

  // Count modules by type
  const videoCount = modules.filter((m) => m.module_type === 'VIDEO').length
  const quizCount = modules.filter((m) => m.module_type === 'QUIZ').length
  const exerciseCount = modules.filter((m) => m.module_type === 'EXERCISE').length

  return (
    <div className="space-y-6">
      {/* Add Module Section */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-md">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-xl">Add Content</CardTitle>
              <p className="text-sm text-muted-foreground">
                Choose a module type to add to your course
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {moduleTypes.map((moduleType) => {
              const Icon = moduleType.icon
              const isHovered = hoveredType === moduleType.type

              return (
                <button
                  key={moduleType.type}
                  onClick={() => handleAddModule(moduleType.type)}
                  onMouseEnter={() => setHoveredType(moduleType.type)}
                  onMouseLeave={() => setHoveredType(null)}
                  className={`
                    relative group p-6 rounded-xl border-2 text-left
                    transition-all duration-300 ease-out
                    ${moduleType.borderColor}
                    bg-gradient-to-br ${moduleType.bgGradient}
                    hover:shadow-lg hover:shadow-${moduleType.type === 'VIDEO' ? 'blue' : moduleType.type === 'QUIZ' ? 'purple' : 'green'}-500/10
                    hover:-translate-y-1 hover:scale-[1.02]
                    active:scale-[0.98]
                  `}
                >
                  {/* Animated background gradient on hover */}
                  <div className={`
                    absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100
                    bg-gradient-to-br ${moduleType.bgGradient}
                    transition-opacity duration-300
                  `} />

                  <div className="relative z-10">
                    {/* Icon */}
                    <div className={`
                      inline-flex p-3 rounded-xl ${moduleType.iconBg}
                      transition-transform duration-300
                      group-hover:scale-110 group-hover:rotate-3
                    `}>
                      <Icon className={`
                        w-6 h-6 bg-gradient-to-br ${moduleType.gradient}
                        bg-clip-text text-transparent
                        transition-transform duration-300
                      `} style={{
                        color: moduleType.type === 'VIDEO' ? '#3b82f6' :
                               moduleType.type === 'QUIZ' ? '#a855f7' : '#22c55e'
                      }} />
                    </div>

                    {/* Text */}
                    <h3 className="font-semibold mt-4 text-foreground">
                      {moduleType.label}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {moduleType.description}
                    </p>

                    {/* Add indicator */}
                    <div className={`
                      flex items-center gap-1.5 mt-4 text-sm font-medium
                      transition-all duration-300
                      ${isHovered ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-2'}
                    `} style={{
                      color: moduleType.type === 'VIDEO' ? '#3b82f6' :
                             moduleType.type === 'QUIZ' ? '#a855f7' : '#22c55e'
                    }}>
                      <Plus className="w-4 h-4" />
                      <span>Add {moduleType.label}</span>
                    </div>
                  </div>

                  {/* Corner decoration */}
                  <div className={`
                    absolute top-3 right-3 p-1.5 rounded-full
                    bg-gradient-to-br ${moduleType.gradient}
                    opacity-0 group-hover:opacity-100
                    scale-0 group-hover:scale-100
                    transition-all duration-300
                  `}>
                    <Plus className="w-3 h-3 text-white" />
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      {/* Module List Section */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <CardTitle>Course Modules</CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Drag to reorder • Click to edit
              </p>
            </div>
            <div className="flex gap-2">
              <Badge variant="secondary" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
                <Video className="w-3 h-3 mr-1" />
                {videoCount} Video{videoCount !== 1 ? 's' : ''}
              </Badge>
              <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-600 border-purple-500/20">
                <HelpCircle className="w-3 h-3 mr-1" />
                {quizCount} Quiz{quizCount !== 1 ? 'zes' : ''}
              </Badge>
              <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
                <FileQuestion className="w-3 h-3 mr-1" />
                {exerciseCount} Exercise{exerciseCount !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ModuleList
            courseId={courseId}
            modules={modules}
            onModulesChange={setModules}
            onEdit={handleEditModule}
            onDelete={handleDeleteModule}
          />
        </CardContent>
      </Card>

      <ModuleEditorDialog
        courseId={courseId}
        module={editingModule}
        isOpen={isDialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveModule}
      />
    </div>
  )
}
