import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { BookOpen, Clock, BarChart3, User } from 'lucide-react'
import { CourseFilters } from '@/components/dashboard/course-filters'

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

  // Fetch filter options
  const [
    { data: teachers },
    { data: styles },
    { data: teacherInstruments }
  ] = await Promise.all([
    supabase.from('teachers').select('id, name').order('name'),
    supabase.from('musical_styles').select('name').order('name'),
    supabase.from('teachers').select('instrument').not('instrument', 'is', null)
  ])

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
      lessons(id)
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

  return (
    <>
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-heading mb-2">Browse Courses</h1>
        <p className="text-muted-foreground">
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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filteredCourses.map((course: any) => (
              <Link key={course.id} href={`/dashboard/course/${course.slug || course.id}`} className="group">
                <Card className="overflow-hidden h-full hover:bg-secondary/30 transition-colors">
                  <div className="aspect-video bg-muted relative overflow-hidden">
                    {course.thumbnail_url ? (
                      <img
                        src={course.thumbnail_url}
                        alt={course.title}
                        className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                        <BookOpen className="h-10 w-10 text-primary/50" />
                      </div>
                    )}
                    {course.difficulty && (
                      <Badge
                        variant="outline"
                        className={`absolute top-2 right-2 capitalize ${getDifficultyColor(course.difficulty)}`}
                      >
                        {course.difficulty}
                      </Badge>
                    )}
                  </div>
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className="text-xs">
                        {course.musical_style?.name || 'Course'}
                      </Badge>
                      {course.teacher?.instrument && (
                        <Badge variant="secondary" className="text-xs">
                          {course.teacher.instrument}
                        </Badge>
                      )}
                    </div>
                    <CardTitle className="line-clamp-2 text-base group-hover:text-primary transition-colors">
                      {course.title}
                    </CardTitle>
                    <CardDescription className="line-clamp-2 text-sm">
                      {course.description || `Master ${course.musical_style?.name || 'Latin music'} with expert instruction`}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <User className="h-3.5 w-3.5" />
                        <span className="truncate max-w-[100px]">{course.teacher?.name || 'Instructor'}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <BookOpen className="h-3.5 w-3.5" />
                        <span>{course.lessons?.length || 0} lessons</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-4">
            {filteredCourses.map((course: any) => (
              <Link key={course.id} href={`/dashboard/course/${course.slug || course.id}`} className="group block">
                <Card className="overflow-hidden hover:bg-secondary/30 transition-colors">
                  <div className="flex flex-col sm:flex-row">
                    <div className="sm:w-64 aspect-video sm:aspect-auto bg-muted flex-shrink-0 relative overflow-hidden">
                      {course.thumbnail_url ? (
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-300"
                        />
                      ) : (
                        <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                          <BookOpen className="h-10 w-10 text-primary/50" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 p-4 sm:p-6">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <Badge variant="outline" className="text-xs">
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
                          <Badge variant="secondary" className="text-xs">
                            {course.teacher.instrument}
                          </Badge>
                        )}
                      </div>
                      <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
                        {course.title}
                      </h3>
                      <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                        {course.description || `Master ${course.musical_style?.name || 'Latin music'} with expert instruction`}
                      </p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="h-4 w-4" />
                          <span>{course.teacher?.name || 'Instructor'}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <BookOpen className="h-4 w-4" />
                          <span>{course.lessons?.length || 0} lessons</span>
                        </div>
                        {course.musical_style?.country?.name && (
                          <div className="flex items-center gap-1.5">
                            <BarChart3 className="h-4 w-4" />
                            <span>{course.musical_style.country.name}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
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
