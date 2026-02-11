import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface PageProps {
  params: Promise<{
    countrySlug: string
    styleSlug: string
  }>
}

export default async function StyleCoursesPage({ params }: PageProps) {
  const { countrySlug, styleSlug } = await params
  const supabase = await createClient()

  // Get the country
  const { data: country } = await supabase
    .from('countries')
    .select('*')
    .eq('slug', countrySlug)
    .single()

  if (!country) {
    notFound()
  }

  // Get the musical style
  const { data: style } = await supabase
    .from('musical_styles')
    .select('*')
    .eq('slug', styleSlug)
    .eq('country_id', country.id)
    .single()

  if (!style) {
    notFound()
  }

  // Get all published courses for this style
  const { data: courses } = await supabase
    .from('courses')
    .select(`
      *,
      course_modules:course_modules(id)
    `)
    .eq('musical_style_id', style.id)
    .eq('is_published', true)
    .order('order_index')

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-4">
          <Link href="/" className="text-sm text-muted-foreground hover:text-primary">
            ← Back to home
          </Link>
        </div>
        <div className="flex items-center gap-2 mb-2">
          <Badge variant="outline">{country.name}</Badge>
        </div>
        <h1 className="text-4xl font-bold mb-2">{style.name}</h1>
        {style.description && (
          <p className="text-lg text-muted-foreground">{style.description}</p>
        )}
      </div>

      {/* Courses Grid */}
      {courses && courses.length > 0 ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {courses.map((course) => (
            <Card key={course.id} className="overflow-hidden flex flex-col">
              {course.thumbnail_url && (
                <div className="aspect-video bg-muted relative">
                  <img
                    src={course.thumbnail_url}
                    alt={course.title}
                    className="object-cover w-full h-full"
                  />
                </div>
              )}
              <CardHeader className="flex-1">
                <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                <CardDescription className="line-clamp-3">
                  {course.description}
                </CardDescription>
                <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                  {course.course_modules && (
                    <span>{course.course_modules.length} lessons</span>
                  )}
                </div>
                {course.teacher_name && (
                  <div className="mt-2 flex items-center gap-2">
                    {course.teacher_image_url && (
                      <img
                        src={course.teacher_image_url}
                        alt={course.teacher_name}
                        className="w-8 h-8 rounded-full"
                      />
                    )}
                    <span className="text-sm text-muted-foreground">
                      by {course.teacher_name}
                    </span>
                  </div>
                )}
              </CardHeader>
              <CardContent>
                <Button asChild className="w-full">
                  <Link href={`/course/${course.id}`}>
                    View Course
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Courses Available</CardTitle>
            <CardDescription>
              There are no published courses for {style.name} yet. Check back soon!
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">Browse Other Styles</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
