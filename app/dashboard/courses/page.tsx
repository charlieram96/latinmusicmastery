import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { BookOpen, User, PlayCircle, Globe, Music, Disc3 } from 'lucide-react'
import { CourseFilters } from '@/components/dashboard/course-filters'
import { redirect } from 'next/navigation'

interface PageProps {
  searchParams: Promise<{
    search?: string
    teachers?: string
    difficulty?: string
    style?: string
    instrument?: string
    view?: string
  }>
}

export default async function BrowseCoursesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    redirect('/login')
  }

  // Fetch filter options and user progress
  const [
    { data: teachers },
    { data: styles },
    { data: teacherInstruments },
    { data: userProgress }
  ] = await Promise.all([
    supabase.from('teachers').select('id, name').order('name'),
    supabase.from('musical_styles').select('name').order('name'),
    supabase.from('teachers').select('instrument').not('instrument', 'is', null),
    supabase.from('user_progress_legacy').select('module_id, completed, module:course_modules_legacy(course_id)').eq('user_id', user.id)
  ])

  // Create a map of course progress
  const courseProgressMap = new Map<string, { started: boolean; completed: number }>()
  userProgress?.forEach((progress: any) => {
    const courseId = progress.module?.course_id
    if (courseId) {
      const existing = courseProgressMap.get(courseId) || { started: false, completed: 0 }
      existing.started = true
      if (progress.completed) existing.completed++
      courseProgressMap.set(courseId, existing)
    }
  })

  // Get unique instruments
  const instruments = [...new Set(teacherInstruments?.map(t => t.instrument).filter(Boolean))] as string[]

  // Build course query with filters
  let query = supabase
    .from('courses')
    .select(`
      *,
      musical_style:musical_styles(
        name,
        country:countries(name, slug)
      ),
      teacher:teachers(id, name, instrument, image_url),
      course_modules_legacy(id)
    `)
    .eq('is_published', true)

  // Apply search filter
  if (params.search) {
    query = query.or(`title.ilike.%${params.search}%,description.ilike.%${params.search}%`)
  }

  // Apply difficulty filter
  if (params.difficulty) {
    query = query.eq('difficulty', params.difficulty)
  }

  // Apply style filter
  if (params.style) {
    query = query.eq('musical_style.name', params.style)
  }

  // Apply instrument filter (through teacher)
  if (params.instrument) {
    query = query.eq('teacher.instrument', params.instrument)
  }

  const { data: courses } = await query.order('created_at', { ascending: false })

  // Filter by teachers client-side (Supabase doesn't support IN on foreign keys easily)
  let filteredCourses = courses || []
  if (params.teachers) {
    const teacherIds = params.teachers.split(',')
    filteredCourses = filteredCourses.filter((course: any) =>
      course.teacher && teacherIds.includes(course.teacher.id)
    )
  }

  // Filter by style client-side for nested filter
  if (params.style) {
    filteredCourses = filteredCourses.filter((course: any) =>
      course.musical_style?.name === params.style
    )
  }

  // Filter by instrument client-side
  if (params.instrument) {
    filteredCourses = filteredCourses.filter((course: any) =>
      course.teacher?.instrument === params.instrument
    )
  }

  // Get total count (unfiltered)
  const { count: totalCount } = await supabase
    .from('courses')
    .select('id', { count: 'exact', head: true })
    .eq('is_published', true)

  const view = params.view || 'grid'

  const getDifficultyColor = (difficulty: string | null) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-500/10 text-green-500 border-green-500/20'
      case 'intermediate':
        return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
      case 'advanced':
        return 'bg-red-500/10 text-red-500 border-red-500/20'
      default:
        return ''
    }
  }

  // Color schemes for different tag types
  const getStyleColor = () => 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
  const getInstrumentColor = () => 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
  const getCountryColor = () => 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'

  return (
    <>
      {/* Page Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading mb-1 sm:mb-2">Browse Courses</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          Explore all available courses and start learning today
        </p>
      </div>

      {/* Filters */}
      <CourseFilters
        options={{
          teachers: teachers || [],
          styles: styles || [],
          instruments
        }}
        totalCount={totalCount || 0}
        filteredCount={filteredCourses.length}
      />

      {/* Courses */}
      {filteredCourses.length > 0 ? (
        view === 'grid' ? (
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCourses.map((course: any) => {
              const progress = courseProgressMap.get(course.id)
              const hasStarted = progress?.started || false

              return (
                <Card key={course.id} className="overflow-hidden h-full transition-colors group flex flex-col p-0 gap-0">
                  <Link href={`/dashboard/course/${course.slug || course.id}`} className="flex-1 flex flex-col">
                    <div className="aspect-video bg-muted relative overflow-hidden">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                          <BookOpen className="h-10 w-10 text-primary/50" />
                        </div>
                      )}
                      {course.difficulty && (
                        <Badge
                          variant="outline"
                          className={`absolute top-3 right-3 capitalize bg-background/90 backdrop-blur-sm ${getDifficultyColor(course.difficulty)}`}
                        >
                          {course.difficulty}
                        </Badge>
                      )}
                    </div>
                    <div className="p-4 flex flex-col flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <Badge variant="outline" className={`text-xs ${getStyleColor()}`}>
                          <Music className="h-3 w-3 mr-1" />
                          {course.musical_style?.name || 'Course'}
                        </Badge>
                        {course.teacher?.instrument && (
                          <Badge variant="outline" className={`text-xs ${getInstrumentColor()}`}>
                            <Disc3 className="h-3 w-3 mr-1" />
                            {course.teacher.instrument}
                          </Badge>
                        )}
                        {course.musical_style?.country?.name && (
                          <Badge variant="outline" className={`text-xs ${getCountryColor()}`}>
                            <Globe className="h-3 w-3 mr-1" />
                            {course.musical_style.country.name}
                          </Badge>
                        )}
                      </div>
                      <h3 className="font-semibold text-base line-clamp-2 group-hover:text-primary transition-colors mb-2">
                        {course.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {course.description || `Master ${course.musical_style?.name || 'Latin music'} with expert instruction`}
                      </p>
                      <div className="flex items-center justify-between text-sm text-muted-foreground mt-auto">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="truncate max-w-[100px]">{course.teacher?.name || 'Instructor'}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <BookOpen className="h-4 w-4" />
                          <span>{course.course_modules?.length || 0} lessons</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  <div className="px-4 pb-4">
                    <Button asChild className="w-full gap-2" variant={hasStarted ? 'default' : 'outline'}>
                      <Link href={`/dashboard/course/${course.slug || course.id}`}>
                        {hasStarted ? (
                          <>
                            <PlayCircle className="h-4 w-4" />
                            Continue Course
                          </>
                        ) : (
                          <>
                            <BookOpen className="h-4 w-4" />
                            View Course
                          </>
                        )}
                      </Link>
                    </Button>
                  </div>
                </Card>
              )
            })}
          </div>
        ) : (
          /* List View */
          <div className="space-y-3 sm:space-y-4">
            {filteredCourses.map((course: any) => {
              const progress = courseProgressMap.get(course.id)
              const hasStarted = progress?.started || false

              return (
                <Card key={course.id} className="overflow-hidden transition-colors group p-0 gap-0">
                  <div className="flex flex-col sm:flex-row">
                    <Link href={`/dashboard/course/${course.slug || course.id}`} className="sm:w-56 md:w-72 sm:h-36 md:h-44 aspect-video sm:aspect-auto bg-muted flex-shrink-0 relative overflow-hidden">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="object-cover w-full h-full"
                        />
                      ) : (
                        <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                          <BookOpen className="h-10 w-10 text-primary/50" />
                        </div>
                      )}
                    </Link>
                    <div className="flex-1 p-4 sm:p-5 flex flex-col">
                      <div className="flex flex-wrap items-center gap-1.5 mb-2">
                        <Badge variant="outline" className={`text-xs ${getStyleColor()}`}>
                          <Music className="h-3 w-3 mr-1" />
                          {course.musical_style?.name || 'Course'}
                        </Badge>
                        {course.difficulty && (
                          <Badge
                            variant="outline"
                            className={`text-xs capitalize ${getDifficultyColor(course.difficulty)}`}
                          >
                            {course.difficulty}
                          </Badge>
                        )}
                        {course.teacher?.instrument && (
                          <Badge variant="outline" className={`text-xs ${getInstrumentColor()}`}>
                            <Disc3 className="h-3 w-3 mr-1" />
                            {course.teacher.instrument}
                          </Badge>
                        )}
                        {course.musical_style?.country?.name && (
                          <Badge variant="outline" className={`text-xs ${getCountryColor()}`}>
                            <Globe className="h-3 w-3 mr-1" />
                            {course.musical_style.country.name}
                          </Badge>
                        )}
                      </div>
                      <Link href={`/dashboard/course/${course.slug || course.id}`}>
                        <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
                          {course.title}
                        </h3>
                      </Link>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                        {course.description || `Master ${course.musical_style?.name || 'Latin music'} with expert instruction`}
                      </p>
                      <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 sm:gap-4 mt-auto">
                        <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4" />
                            <span>{course.teacher?.name || 'Instructor'}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <BookOpen className="h-4 w-4" />
                            <span>{course.course_modules?.length || 0} lessons</span>
                          </div>
                        </div>
                        <Button asChild className="gap-2 w-full sm:w-auto" variant={hasStarted ? 'default' : 'outline'}>
                          <Link href={`/dashboard/course/${course.slug || course.id}`}>
                            {hasStarted ? (
                              <>
                                <PlayCircle className="h-4 w-4" />
                                Continue Course
                              </>
                            ) : (
                              <>
                                <BookOpen className="h-4 w-4" />
                                View Course
                              </>
                            )}
                          </Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Courses Found</h3>
            <p className="text-muted-foreground mb-4">
              Try adjusting your filters or search to find what you're looking for
            </p>
            <Button variant="outline" asChild>
              <Link href="/dashboard/courses">Clear all filters</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}
