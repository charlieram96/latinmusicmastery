import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Crown, GraduationCap, Music } from 'lucide-react'
import { MasterClassCard } from '@/components/dashboard/master-class-card'

export default async function MasterClassPage() {
  const supabase = await createClient()

  const { data: courses } = await supabase
    .from('courses')
    .select(`
      id,
      title,
      slug,
      thumbnail_url,
      difficulty,
      teacher_name,
      teacher_image_url,
      instrument,
      musical_style:musical_styles(name)
    `)
    .eq('is_master_class', true)
    .eq('is_published', true)
    .order('created_at', { ascending: false })

  const masterClasses = courses || []

  const totalClasses = masterClasses.length
  const uniqueTeachers = [...new Set(masterClasses.map(c => c.teacher_name))].length
  const uniqueInstruments = [...new Set(masterClasses.map(c => c.instrument).filter(Boolean))].length

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-heading mb-2">
          Master Class<span className="text-primary">.</span>
        </h1>
        <p className="text-muted-foreground mb-6">
          Premium lessons from world-renowned musicians and master instructors
        </p>

        {/* Quick Stats */}
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
            <Crown className="h-5 w-5 text-primary" />
            <span className="font-semibold">{totalClasses} Master {totalClasses === 1 ? 'Class' : 'Classes'}</span>
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
            <GraduationCap className="h-5 w-5 text-primary" />
            <span className="font-semibold">{uniqueTeachers} Featured {uniqueTeachers === 1 ? 'Teacher' : 'Teachers'}</span>
          </div>
          <div className="flex items-center gap-2 bg-secondary rounded-lg px-4 py-2">
            <Music className="h-5 w-5 text-primary" />
            <span className="font-semibold">{uniqueInstruments} {uniqueInstruments === 1 ? 'Instrument' : 'Instruments'}</span>
          </div>
        </div>
      </div>

      {/* Master Classes Grid */}
      {masterClasses.length > 0 ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {masterClasses.map((course) => (
            <MasterClassCard key={course.id} course={course} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <Card>
          <CardContent className="p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-amber-500/10 flex items-center justify-center mx-auto mb-4">
              <Crown className="h-8 w-8 text-amber-500" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Coming Soon</h3>
            <p className="text-muted-foreground">
              Master classes from world-renowned instructors are on the way. Stay tuned!
            </p>
          </CardContent>
        </Card>
      )}
    </>
  )
}
