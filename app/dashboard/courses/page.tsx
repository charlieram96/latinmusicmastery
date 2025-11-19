import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'

export default async function BrowseCoursesPage() {
  const supabase = await createClient()

  // Fetch all published courses
  const { data: courses } = await supabase
    .from('courses')
    .select(`
      *,
      musical_style:musical_styles(
        name,
        country:countries(name, slug)
      ),
      teacher:teachers(name, instrument)
    `)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  // Group courses by country
  const coursesByCountry = courses?.reduce((acc: any, course: any) => {
    const country = course.musical_style.country.name
    if (!acc[country]) {
      acc[country] = []
    }
    acc[country].push(course)
    return acc
  }, {})

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Browse Courses</h1>
        <p className="text-muted-foreground">
          Explore all available courses and start learning today
        </p>
      </div>

      {/* Courses by Country */}
      {coursesByCountry && Object.keys(coursesByCountry).length > 0 ? (
        <div className="space-y-12">
          {Object.entries(coursesByCountry).map(([country, countryCourses]: [string, any]) => (
            <div key={country}>
              <h2 className="text-2xl font-bold mb-6">{country}</h2>
              <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {countryCourses.map((course: any) => (
                  <Card key={course.id} className="overflow-hidden hover:shadow-lg transition-shadow">
                    {course.thumbnail_url && (
                      <div className="aspect-video bg-muted relative">
                        <img
                          src={course.thumbnail_url}
                          alt={course.title}
                          className="object-cover w-full h-full"
                        />
                      </div>
                    )}
                    <CardHeader>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <Badge variant="outline">{course.musical_style.name}</Badge>
                        {course.teacher && (
                          <Badge variant="secondary" className="text-xs">
                            {course.teacher.name}
                          </Badge>
                        )}
                      </div>
                      <CardTitle className="line-clamp-2">{course.title}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {course.description || `Master ${course.musical_style.name} with expert instruction`}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button asChild className="w-full">
                        <Link href={`/course/${course.id}`}>
                          <BookOpen className="w-4 h-4 mr-2" />
                          View Course
                        </Link>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="p-12 text-center">
            <BookOpen className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No Courses Available</h3>
            <p className="text-muted-foreground">
              Check back soon for new courses!
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
