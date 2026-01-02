import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, BookOpen, User, Music, Globe, Disc3, Pencil } from 'lucide-react'

export default async function CoursesPage() {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from('courses')
    .select(`
      *,
      musical_style:musical_styles(name, country:countries(name)),
      teacher:teachers(id, name, instrument),
      lessons(id)
    `)
    .order('created_at', { ascending: false })

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
  const getInstrumentColor = () => 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
  const getCountryColor = () => 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Courses</h1>
          <p className="text-muted-foreground">
            Manage all courses
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/courses/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Course
          </Link>
        </Button>
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
                    <Badge className="bg-green-500/90 hover:bg-green-500/90 text-white border-0">
                      Published
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-500/90 hover:bg-gray-500/90 text-white border-0">
                      Draft
                    </Badge>
                  )}
                </div>
                {course.difficulty && (
                  <Badge
                    variant="outline"
                    className={`absolute top-3 right-3 capitalize bg-background/90 backdrop-blur-sm ${getDifficultyColor(course.difficulty)}`}
                  >
                    {course.difficulty}
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

                {course.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                    {course.description}
                  </p>
                )}

                <div className="flex items-center justify-between text-sm text-muted-foreground mt-auto pt-3 border-t">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    <span className="truncate max-w-[100px]">{course.teacher?.name || 'Unassigned'}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <BookOpen className="h-4 w-4" />
                    <span>{course.lessons?.length || 0} lessons</span>
                  </div>
                </div>
              </CardContent>

              <div className="px-4 pb-4">
                <Button asChild className="w-full gap-2" variant="outline">
                  <Link href={`/admin/courses/${course.id}`}>
                    <Pencil className="h-4 w-4" />
                    Edit Course
                  </Link>
                </Button>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Courses</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Create your first course to start building content.
            </p>
            <Button asChild>
              <Link href="/admin/courses/new">Add Course</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
