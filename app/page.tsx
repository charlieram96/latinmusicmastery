import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: countries } = await supabase
    .from('countries')
    .select('*, musical_styles(*)')
    .order('name')

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-orange-500 via-red-500 to-pink-500 text-white py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center space-y-6">
            <h1 className="text-5xl md:text-7xl font-bold">
              Latin Music Mastery
            </h1>
            <p className="text-xl md:text-2xl text-white/90 max-w-3xl mx-auto">
              Master the rhythms of Latin America. Learn Salsa, Bachata, Reggaeton, and more from expert instructors.
            </p>
            <div className="flex gap-4 justify-center flex-wrap">
              <Button asChild size="lg" className="bg-white text-orange-600 hover:bg-gray-100">
                <Link href="/signup">Start Learning</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="border-white text-white hover:bg-white/10">
                <Link href="#courses">Browse Courses</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Countries & Styles Section */}
      <section id="courses" className="py-20 px-4 bg-gray-50">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Explore Our Courses</h2>
            <p className="text-xl text-gray-600">
              Discover the rich musical traditions of Latin America
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {countries?.map((country) => (
              <Card key={country.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="text-2xl">{country.name}</CardTitle>
                  <CardDescription>{country.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <h4 className="font-semibold mb-3">Musical Styles:</h4>
                  <div className="flex flex-wrap gap-2">
                    {country.musical_styles?.map((style) => (
                      <Link
                        key={style.id}
                        href={`/courses/${country.slug}/${style.slug}`}
                        className="px-3 py-1 bg-orange-100 text-orange-700 rounded-full text-sm hover:bg-orange-200 transition-colors"
                      >
                        {style.name}
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold mb-4">Why Latin Music Mastery?</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <CardTitle>Expert Instructors</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Learn from professional musicians with decades of experience in Latin music.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Interactive Lessons</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Engage with Soundslice technology and interactive exercises to master each style.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Comprehensive Content</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Access courses covering multiple countries and musical styles, all in one platform.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-orange-600 to-red-600 text-white py-16 px-4">
        <div className="container mx-auto max-w-4xl text-center space-y-6">
          <h2 className="text-4xl font-bold">Ready to Start Your Journey?</h2>
          <p className="text-xl text-white/90">
            Get unlimited access to all courses with a single subscription.
          </p>
          <Button asChild size="lg" className="bg-white text-orange-600 hover:bg-gray-100">
            <Link href="/signup">Sign Up Now</Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8 px-4">
        <div className="container mx-auto max-w-6xl text-center">
          <p>&copy; 2025 Latin Music Mastery. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
