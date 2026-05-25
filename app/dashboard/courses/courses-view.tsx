'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { BookOpen, User, PlayCircle, Globe, Music, Disc3 } from 'lucide-react'
import { getInstrumentColor, SUBSCRIBABLE_INSTRUMENTS, INSTRUMENT_CONFIG } from '@/lib/instruments'
import { CourseFilters } from '@/components/dashboard/course-filters'
import { useTranslation } from '@/components/language-provider'

interface CoursesViewProps {
  params: {
    search?: string
    teachers?: string
    difficulty?: string
    style?: string
    instrument?: string
    view?: string
  }
  filteredCourses: any[]
  coursesByInstrument: [string, any[]][]
  showGroupHeadings: boolean
  view: string
  teachers: { id: string; name: string }[]
  styles: { name: string }[]
  totalCount: number
  courseProgressEntries: [string, { started: boolean; completed: number }][]
}

export function CoursesView({
  params,
  filteredCourses,
  coursesByInstrument,
  showGroupHeadings,
  view,
  teachers,
  styles,
  totalCount,
  courseProgressEntries,
}: CoursesViewProps) {
  const { t } = useTranslation()
  const courseProgressMap = new Map(courseProgressEntries)

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

  const difficultyLabel = (d: string) => {
    if (d === 'beginner') return t('dashboard.pages.courses.difficulty.beginner')
    if (d === 'intermediate') return t('dashboard.pages.courses.difficulty.intermediate')
    if (d === 'advanced') return t('dashboard.pages.courses.difficulty.advanced')
    return d
  }

  return (
    <>
      {/* Page Header */}
      <div className="mb-4 sm:mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold font-heading mb-1 sm:mb-2">{t('dashboard.pages.courses.title')}</h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t('dashboard.pages.courses.subtitle')}
        </p>
      </div>

      {/* Instrument Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 scrollbar-hide">
        <Link
          href="/dashboard/courses"
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
            !params.instrument
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          {t('dashboard.pages.courses.tabs.all')}
        </Link>
        {SUBSCRIBABLE_INSTRUMENTS.map((inst) => {
          const isActive = params.instrument === inst
          const config = INSTRUMENT_CONFIG[inst]
          return (
            <Link
              key={inst}
              href={`/dashboard/courses?instrument=${inst}`}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                isActive
                  ? config?.color || 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
              }`}
            >
              {inst}
            </Link>
          )
        })}
      </div>

      {/* Filters */}
      <CourseFilters
        options={{
          teachers: teachers || [],
          styles: styles || [],
          instruments: SUBSCRIBABLE_INSTRUMENTS as unknown as string[],
        }}
        totalCount={totalCount}
        filteredCount={filteredCourses.length}
      />

      {/* Courses */}
      {filteredCourses.length > 0 ? (
        <>
          {coursesByInstrument.map(([instrument, courses]) => (
            <div key={instrument}>
              {showGroupHeadings && (
                <h2 className="text-xl font-bold mb-4 mt-8 first:mt-0 flex items-center gap-2">
                  {instrument}
                </h2>
              )}
              {view === 'grid' ? (
                <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {courses.map((course: any) => {
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
                                {difficultyLabel(course.difficulty)}
                              </Badge>
                            )}
                          </div>
                          <div className="p-4 flex flex-col flex-1">
                            <div className="flex flex-wrap items-center gap-1.5 mb-2">
                              <Badge variant="outline" className={`text-xs ${getStyleColor()}`}>
                                <Music className="h-3 w-3 mr-1" />
                                {course.musical_style?.name || t('dashboard.pages.courses.badges.courseFallback')}
                              </Badge>
                              {course.instrument && !params.instrument && (
                                <Badge variant="outline" className={`text-xs ${getInstrumentColor(course.instrument)}`}>
                                  <Disc3 className="h-3 w-3 mr-1" />
                                  {course.instrument}
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
                              {course.description ||
                                t('dashboard.pages.courses.descriptionFallback', {
                                  style: course.musical_style?.name || t('dashboard.pages.courses.latinMusic'),
                                })}
                            </p>
                            <div className="flex items-center justify-between text-sm text-muted-foreground mt-auto">
                              <div className="flex items-center gap-2">
                                <User className="h-4 w-4" />
                                <span className="truncate max-w-[100px]">
                                  {course.teacher?.name || t('dashboard.pages.courses.instructor')}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <BookOpen className="h-4 w-4" />
                                <span>
                                  {t('dashboard.pages.courses.lessonCount', { count: course.course_sections?.reduce((acc: number, s: any) => acc + (s.classes?.length || 0), 0) || 0 })}
                                </span>
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
                                  {t('dashboard.pages.courses.continueCourse')}
                                </>
                              ) : (
                                <>
                                  <BookOpen className="h-4 w-4" />
                                  {t('dashboard.pages.courses.viewCourse')}
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
                  {courses.map((course: any) => {
                    const progress = courseProgressMap.get(course.id)
                    const hasStarted = progress?.started || false

                    return (
                      <Card key={course.id} className="overflow-hidden transition-colors group p-0 gap-0">
                        <div className="flex flex-col sm:flex-row">
                          <Link
                            href={`/dashboard/course/${course.slug || course.id}`}
                            className="sm:w-56 md:w-72 sm:h-36 md:h-44 aspect-video sm:aspect-auto bg-muted flex-shrink-0 relative overflow-hidden"
                          >
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
                                {course.musical_style?.name || t('dashboard.pages.courses.badges.courseFallback')}
                              </Badge>
                              {course.difficulty && (
                                <Badge
                                  variant="outline"
                                  className={`text-xs capitalize ${getDifficultyColor(course.difficulty)}`}
                                >
                                  {difficultyLabel(course.difficulty)}
                                </Badge>
                              )}
                              {course.instrument && !params.instrument && (
                                <Badge variant="outline" className={`text-xs ${getInstrumentColor(course.instrument)}`}>
                                  <Disc3 className="h-3 w-3 mr-1" />
                                  {course.instrument}
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
                              {course.description ||
                                t('dashboard.pages.courses.descriptionFallback', {
                                  style: course.musical_style?.name || t('dashboard.pages.courses.latinMusic'),
                                })}
                            </p>
                            <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center justify-between gap-3 sm:gap-4 mt-auto">
                              <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-2">
                                  <User className="h-4 w-4" />
                                  <span>{course.teacher?.name || t('dashboard.pages.courses.instructor')}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <BookOpen className="h-4 w-4" />
                                  <span>
                                    {t('dashboard.pages.courses.lessonCount', { count: course.course_sections?.reduce((acc: number, s: any) => acc + (s.classes?.length || 0), 0) || 0 })}
                                  </span>
                                </div>
                              </div>
                              <Button asChild className="gap-2 w-full sm:w-auto" variant={hasStarted ? 'default' : 'outline'}>
                                <Link href={`/dashboard/course/${course.slug || course.id}`}>
                                  {hasStarted ? (
                                    <>
                                      <PlayCircle className="h-4 w-4" />
                                      {t('dashboard.pages.courses.continueCourse')}
                                    </>
                                  ) : (
                                    <>
                                      <BookOpen className="h-4 w-4" />
                                      {t('dashboard.pages.courses.viewCourse')}
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
              )}
            </div>
          ))}
        </>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">{t('dashboard.pages.courses.empty.title')}</h3>
            <p className="text-muted-foreground mb-4">
              {t('dashboard.pages.courses.empty.subtitle')}
            </p>
            <Button variant="outline" asChild>
              <Link href="/dashboard/courses">{t('dashboard.pages.courses.empty.clearFilters')}</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </>
  )
}
