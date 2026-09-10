import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { listSongs, createBlankScoreForSong, deleteSong } from '@/app/actions/playsense-studio'
import { SongImportButton } from '@/components/playsense-studio/studio/song-import-button'

export default async function AdminPlaySensePage() {
  const { data: songs, error } = await listSongs()

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-500/10 text-green-500'
      case 'intermediate': return 'bg-yellow-500/10 text-yellow-500'
      case 'advanced': return 'bg-red-500/10 text-red-500'
      default: return ''
    }
  }

  async function addSong() {
    'use server'
    const res = await createBlankScoreForSong({})
    if (res.songId) redirect(`/admin/playsense-studio/song/${res.songId}`)
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight mb-1">Play Sense Songs</h1>
          <p className="text-muted-foreground">
            Author score-backed songs in the studio. The rhythm highway is derived from the score.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SongImportButton />
          <form action={addSong}>
            <Button type="submit">
              <Plus className="w-4 h-4 mr-2" />
              Add Song
            </Button>
          </form>
        </div>
      </div>

      {error ? (
        <Card className="p-6 text-sm text-destructive">Failed to load songs: {error}</Card>
      ) : songs && songs.length > 0 ? (
        <div className="space-y-3">
          {songs.map((song) => (
            <Card key={song.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-medium">{song.title}</h3>
                    {song.isPublished ? (
                      <Badge className="bg-green-500/10 text-green-500 border-green-500/20">
                        Published
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Draft</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className={`text-xs ${getDifficultyColor(song.difficulty)}`}>
                      {song.difficulty}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      track {song.trackIndex}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/playsense-studio/song/${song.id}`}>
                      <Pencil className="w-3 h-3 mr-1" />
                      Open studio
                    </Link>
                  </Button>
                  <form action={async () => {
                    'use server'
                    await deleteSong(song.id)
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
            No songs yet. Create your first score-backed song.
          </p>
          <form action={addSong}>
            <Button type="submit">Add Song</Button>
          </form>
        </Card>
      )}
    </div>
  )
}
