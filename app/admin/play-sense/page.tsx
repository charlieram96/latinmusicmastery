import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { deleteExercise } from '@/app/actions/play-sense'

export default async function AdminPlaySensePage() {
  const supabase = await createClient()

  const { data: exercises } = await supabase
    .from('play_sense_exercises')
    .select('*')
    .order('order_index', { ascending: true })

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-500/10 text-green-500'
      case 'intermediate': return 'bg-yellow-500/10 text-yellow-500'
      case 'advanced': return 'bg-red-500/10 text-red-500'
      default: return ''
    }
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-1">Play Sense</h1>
          <p className="text-muted-foreground">Create and manage percussion practice exercises</p>
        </div>
        <Button asChild>
          <Link href="/admin/play-sense/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Exercise
          </Link>
        </Button>
      </div>

      {exercises && exercises.length > 0 ? (
        <div className="space-y-3">
          {exercises.map((exercise) => (
            <Card key={exercise.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{exercise.title}</h3>
                    {exercise.is_published ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        Published
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-1">
                    {exercise.description}
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      {exercise.instrument}
                    </Badge>
                    <Badge variant="outline" className={`text-xs ${getDifficultyColor(exercise.difficulty)}`}>
                      {exercise.difficulty}
                    </Badge>
                    <span className="text-xs text-muted-foreground font-mono">
                      {exercise.bpm} BPM
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {exercise.measures} bars
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {(exercise.events as unknown[])?.length || 0} events
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/play-sense/${exercise.id}`}>
                      <Pencil className="w-3 h-3 mr-1" />
                      Edit
                    </Link>
                  </Button>
                  <form action={async () => {
                    'use server'
                    await deleteExercise(exercise.id)
                  }}>
                    <Button variant="ghost" size="sm" type="submit" className="text-destructive hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </form>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground mb-4">
            No exercises yet. Create your first percussion exercise.
          </p>
          <Button asChild>
            <Link href="/admin/play-sense/new">Add Exercise</Link>
          </Button>
        </Card>
      )}
    </div>
  )
}
