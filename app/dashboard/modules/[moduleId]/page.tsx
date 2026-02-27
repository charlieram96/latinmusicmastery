import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, CheckCircle2, PlayCircle, Lock, FileQuestion, Dumbbell } from 'lucide-react'
import { LessonCompleteButton } from '@/components/lesson-complete-button'
import { canAccessCourse } from '@/lib/subscriptions'

interface PageProps {
  params: Promise<{
    moduleId: string
  }>
}

export default async function ModulePage({ params }: PageProps) {
  const { moduleId } = await params
  const supabase = await createClient()

  // Get user
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Get module with course details
  const { data: module } = await supabase
    .from('course_modules_legacy')
    .select(`
      *,
      course:courses(
        id,
        title,
        instrument,
        musical_style:musical_styles(
          id,
          name,
          slug,
          country:countries(
            id,
            name,
            slug
          )
        )
      )
    `)
    .eq('id', moduleId)
    .single()

  if (!module) {
    notFound()
  }

  // Check access via subscription
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  const isStudent = await canAccessCourse(supabase, user.id, (module.course as any)?.instrument, profile?.is_admin ?? false)

  // Check if user has access
  if (!module.is_free && !isStudent) {
    redirect(`/dashboard/course/${module.course_id}`)
  }

  // Get all modules in this course for navigation
  const { data: courseModules } = await supabase
    .from('course_modules_legacy')
    .select('id, title, order_index, is_free, module_type')
    .eq('course_id', module.course_id)
    .order('order_index')

  // Get user progress for all modules in this course
  const moduleIds = courseModules?.map(m => m.id) || []
  const { data: progressData } = await supabase
    .from('user_progress_legacy')
    .select('*')
    .eq('user_id', user.id)
    .in('module_id', moduleIds)

  const progressMap = new Map(
    progressData?.map(p => [p.module_id, p]) || []
  )

  // Get current module progress
  const currentProgress = progressMap.get(moduleId)

  // Find previous and next modules
  const currentIndex = courseModules?.findIndex(m => m.id === moduleId) || 0
  const previousModule = currentIndex > 0 ? courseModules?.[currentIndex - 1] : null
  const nextModule = currentIndex < (courseModules?.length || 0) - 1 ? courseModules?.[currentIndex + 1] : null

  // Check if next module is accessible (isStudent already accounts for subscription + admin)
  const canAccessNext = nextModule && (nextModule.is_free || isStudent)

  const course = module.course
  const style = course.musical_style
  const country = style.country

  const getModuleIcon = (type: string) => {
    switch (type) {
      case 'QUIZ': return <FileQuestion className="w-4 h-4" />
      case 'EXERCISE': return <Dumbbell className="w-4 h-4" />
      default: return <PlayCircle className="w-4 h-4" />
    }
  }

  return (
    <>
      {/* Top Navigation */}
      <div className="border-b border-border bg-background sticky top-0 z-10 -mx-6 -mt-6 mb-6">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <Button asChild variant="ghost" size="sm">
                <Link href={`/dashboard/course/${course.id}`}>
                  <ArrowLeft className="w-4 h-4 mr-1" />
                  Back to Course
                </Link>
              </Button>
              <div className="flex-1 min-w-0">
                <div className="text-sm text-muted-foreground truncate">
                  {course.title}
                </div>
                <div className="font-medium truncate">
                  {module.title}
                </div>
              </div>
            </div>
            {!currentProgress?.completed && (
              <LessonCompleteButton moduleId={moduleId} userId={user.id} />
            )}
            {currentProgress?.completed && (
              <Badge variant="default" className="gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Completed
              </Badge>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* VIDEO type: Soundslice Embed */}
          {module.module_type === 'VIDEO' && module.soundslice_embed_url && (
            <Card>
              <CardContent className="p-0">
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <iframe
                    src={module.soundslice_embed_url}
                    className="w-full h-full"
                    allow="autoplay; fullscreen"
                    allowFullScreen
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* QUIZ type */}
          {module.module_type === 'QUIZ' && module.question && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileQuestion className="w-5 h-5" />
                  Quiz
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg font-medium mb-4">{module.question}</p>
                {module.options && Array.isArray(module.options) && (
                  <div className="space-y-2">
                    {(module.options as string[]).map((option: string, idx: number) => (
                      <div key={idx} className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
                        {option}
                      </div>
                    ))}
                  </div>
                )}
                {module.explanation && (
                  <p className="text-sm text-muted-foreground mt-4">{module.explanation}</p>
                )}
              </CardContent>
            </Card>
          )}

          {/* EXERCISE type */}
          {module.module_type === 'EXERCISE' && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Dumbbell className="w-5 h-5" />
                  Exercise
                </CardTitle>
              </CardHeader>
              <CardContent>
                {module.question && (
                  <p className="text-lg font-medium mb-4">{module.question}</p>
                )}
                {module.description && (
                  <p className="text-muted-foreground whitespace-pre-wrap">
                    {module.description}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {/* Module Description */}
          {module.description && module.module_type === 'VIDEO' && (
            <Card>
              <CardHeader>
                <CardTitle>About This Lesson</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {module.description}
                </p>
              </CardContent>
            </Card>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between gap-4">
            {previousModule ? (
              <Button asChild variant="outline" className="flex-1">
                <Link href={`/dashboard/modules/${previousModule.id}`}>
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Previous
                </Link>
              </Button>
            ) : (
              <div className="flex-1" />
            )}

            {nextModule && (
              <>
                {canAccessNext ? (
                  <Button asChild className="flex-1">
                    <Link href={`/dashboard/modules/${nextModule.id}`}>
                      Next
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                ) : (
                  <Button disabled className="flex-1">
                    <Lock className="w-4 h-4 mr-2" />
                    Next (Locked)
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Sidebar - Course Modules */}
        <div className="lg:col-span-1">
          <Card className="sticky top-20">
            <CardHeader>
              <CardTitle>Course Content</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[600px] overflow-y-auto">
                {courseModules?.map((courseModule, index) => {
                  const progress = progressMap.get(courseModule.id)
                  const isCompleted = progress?.completed || false
                  const isCurrent = courseModule.id === moduleId
                  const isLocked = !courseModule.is_free && !isStudent

                  const content = (
                    <>
                      <div className="flex-shrink-0">
                        {isCompleted ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : isLocked ? (
                          <Lock className="w-4 h-4" />
                        ) : (
                          getModuleIcon(courseModule.module_type)
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">
                          {index + 1}. {courseModule.title}
                        </div>
                      </div>
                    </>
                  )

                  if (isLocked) {
                    return (
                      <div
                        key={courseModule.id}
                        className="flex items-center gap-3 p-3 rounded-lg opacity-50 cursor-not-allowed"
                      >
                        {content}
                      </div>
                    )
                  }

                  return (
                    <Link
                      key={courseModule.id}
                      href={`/dashboard/modules/${courseModule.id}`}
                      className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                        isCurrent
                          ? 'bg-primary text-primary-foreground'
                          : 'hover:bg-muted'
                      }`}
                    >
                      {content}
                    </Link>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}
