import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus } from 'lucide-react'

export default async function StylesPage() {
  const supabase = await createClient()

  const { data: styles } = await supabase
    .from('musical_styles')
    .select(`
      *,
      country:countries(name, slug),
      courses(id)
    `)
    .order('name')

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Musical Styles</h1>
          <p className="text-muted-foreground">
            Manage musical styles by country
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/styles/new">
            <Plus className="w-4 h-4 mr-2" />
            Add Style
          </Link>
        </Button>
      </div>

      {styles && styles.length > 0 ? (
        <div className="grid gap-4">
          {styles.map((style: any) => (
            <Card key={style.id}>
              <CardContent className="flex items-center justify-between p-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold">{style.name}</h3>
                    <Badge variant="outline">{style.country.name}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">
                    {style.description || 'No description'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Slug: {style.slug} • {style.courses?.length || 0} courses
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/admin/styles/${style.id}`}>Edit</Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No Styles</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Add musical styles to organize your courses.
            </p>
            <Button asChild>
              <Link href="/admin/styles/new">Add Style</Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
