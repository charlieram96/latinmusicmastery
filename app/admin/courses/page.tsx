import { getCourseInstrumentOptions } from '@/lib/courses/instrument-options'
import { localizeCourse } from '@/lib/i18n/localize'
import { courseInstrumentClassifications, matchesCourseInstrument } from '@/lib/courses/instrument-classification'
import { instrumentLabel } from '@/lib/i18n/instruments'
import { adminLabel } from '@/lib/i18n/admin-labels'
import { AdminText } from '@/components/admin/admin-text'
import { getServerLocale } from '@/lib/i18n/server'
import { EditCourseLink } from '@/components/admin/course-studio/edit-course-link'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, BookOpen, User, Music, Globe, Disc3 } from 'lucide-react'
import { getInstrumentColor, COURSE_INSTRUMENTS, getCourseInstrumentLabel, sortCourseInstruments } from '@/lib/instruments'
import { AdminSearch } from '@/components/admin/admin-search'
import { DeleteCourseButton } from '@/components/admin/delete-course-button'

interface PageProps {
  searchParams: Promise<{
    instrument?: string
    q?: string
    /** Deep-link filter from the Musical Styles admin page. No visible UI. */
    style?: string
  }>
}

export default async function CoursesPage({ searchParams }: PageProps) {
  const params = await searchParams
  const [locale, courseInstruments] = await Promise.all([getServerLocale(), getCourseInstrumentOptions()])
  const supabase = await createClient()

  // Build query
  let query = supabase
    .from('courses')
    .select(`
      id, title, title_es, description, description_es, thumbnail_url, is_published, difficulty, instrument,
      musical_style:musical_styles(name, name_es, country:countries(name, name_es)),
      teacher:teachers(name),
      course_sections(classes(id))
    `)
    .order('created_at', { ascending: false })

  if (params.style) {
    query = query.eq('musical_style_id', params.style)
  }


  // These reads are independent. The listing needs class counts, not lesson items.
  const [{ data: courseRows, error: coursesError }, { data: instrumentCounts, error: countsError }] = await Promise.all([
    query,
    supabase.from('courses').select('instrument'),
  ])
  if (coursesError) throw coursesError
  if (countsError) throw countsError
  for (const course of courseRows ?? []) localizeCourse(course, locale)
  const search = params.q?.trim().toLocaleLowerCase(locale)
  const courses = courseRows?.filter((course) =>
    (!params.instrument || matchesCourseInstrument(course.instrument, params.instrument, courseInstruments)) &&
    (!search || course.title.toLocaleLowerCase(locale).includes(search))
  )

  const countMap = new Map<string, number>()
  instrumentCounts?.forEach((c: any) => {
    for (const instrument of courseInstrumentClassifications(c.instrument, courseInstruments)) {
      countMap.set(instrument, (countMap.get(instrument) || 0) + 1)
    }
  })
  const totalCount = instrumentCounts?.length || 0

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

  const getStyleColor = () => 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20'
  const getCountryColor = () => 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-1"><AdminText text={"Courses"} /></h1>
          <p className="text-muted-foreground"><AdminText text={"Manage all courses"} /></p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">
            <Plus className="w-4 h-4 mr-2" /> <AdminText text={"Add Course"} /> </Link>
        </Button>
      </div>

      <div className="mb-6">
        <AdminSearch placeholder="Search courses..." />
      </div>

      {/* Instrument Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-6 scrollbar-hide">
        <Link
          href="/admin/courses"
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            !params.instrument
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        > <AdminText text={"All"} /> <span className={`text-xs px-1.5 py-0.5 rounded-full ${
            !params.instrument ? 'bg-primary-foreground/20' : 'bg-background/50'
          }`}>
            {totalCount}
          </span>
        </Link>
        {sortCourseInstruments(courseInstruments, locale).map((inst) => {
          const count = countMap.get(inst) || 0
          const isActive = params.instrument === inst
          return (
            <Link
              key={inst}
              href={`/admin/courses?instrument=${inst}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {getCourseInstrumentLabel(inst, locale)}
              <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                isActive ? 'bg-primary-foreground/20' : 'bg-background/50'
              }`}>
                {count}
              </span>
            </Link>
          )
        })}
      </div>

      {courses && courses.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {courses.map((course: any) => (
            <Card key={course.id} className="overflow-hidden h-full hover:shadow-lg transition-shadow group flex flex-col p-0 gap-0">
              <div className="aspect-video bg-muted relative overflow-hidden">
                {course.thumbnail_url ? (
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    loading="lazy"
                    decoding="async"
                    className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                    <BookOpen className="h-10 w-10 text-primary/50" />
                  </div>
                )}
                {/* Status Badge */}
                <div className="absolute top-3 left-3">
                  {course.is_published ? (
                    <Badge className="bg-green-500/90 hover:bg-green-500/90 text-white border-0"> <AdminText text={"Published"} /> </Badge>
                  ) : (
                    <Badge className="bg-gray-500/90 hover:bg-gray-500/90 text-white border-0"> <AdminText text={"Draft"} /> </Badge>
                  )}
                </div>
                {course.difficulty && (
                  <Badge
                    variant="outline"
                    className={`absolute top-3 right-3 capitalize bg-background/90 backdrop-blur-sm ${getDifficultyColor(course.difficulty)}`}
                  >
                    {adminLabel(course.difficulty.charAt(0).toUpperCase() + course.difficulty.slice(1), locale)}
                  </Badge>
                )}
              </div>

              <CardContent className="p-4 flex flex-col flex-1">
                <div className="flex flex-wrap items-center gap-1.5 mb-2">
                  {course.musical_style?.name && (
                    <Badge variant="outline" className={`text-xs ${getStyleColor()}`}>
                      <Music className="h-3 w-3 mr-1" />
                      {course.musical_style.name}
                    </Badge>
                  )}
                  {course.instrument && !params.instrument && (
                    <Badge variant="outline" className={`text-xs ${getInstrumentColor(course.instrument)}`}>
                      <Disc3 className="h-3 w-3 mr-1" />
                      {instrumentLabel(course.instrument, locale)}
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

                {course.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {course.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm text-muted-foreground mt-auto pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="truncate max-w-[100px]">{course.teacher?.name || adminLabel('Unassigned', locale)}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    <span>{course.course_sections?.reduce((acc: number, s: any) => acc + (s.classes?.length || 0), 0) || 0} <AdminText text={"classes"} /></span>
                  </div>
                </div>
              </CardContent>

              <div className="px-4 pb-4 flex gap-2">
                <EditCourseLink courseId={course.id} />
                <DeleteCourseButton courseId={course.id} courseTitle={course.title} />
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle><AdminText text={"No Courses"} /></CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              {params.instrument
                ? (locale === 'es' ? `No hay cursos de ${instrumentLabel(params.instrument, locale)}.` : `No courses found for ${params.instrument}.`)
                : (locale === 'es' ? 'Crea tu primer curso para comenzar a añadir contenido.' : 'Create your first course to start building content.')}
            </p>
            <Button asChild>
              <Link href="/admin/courses/new"><AdminText text={"Add Course"} /></Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
