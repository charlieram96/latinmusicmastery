'use client'

import { useEffect, useState, useTransition } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { User, Save, Loader2, Music } from 'lucide-react'
import { getTeacherProfile, updateTeacherProfile } from '@/app/actions/teacher'

export default function TeacherProfilePage() {
  const [isPending, startTransition] = useTransition()
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [bio, setBio] = useState('')
  const [imageUrl, setImageUrl] = useState('')
  const [specialties, setSpecialties] = useState('')
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const data = await getTeacherProfile()
      if (data) {
        setProfile(data)
        setBio(data.bio || '')
        setImageUrl(data.image_url || '')
        setSpecialties(data.specialties?.join(', ') || '')
      }
      setLoading(false)
    }
    loadProfile()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSuccess(false)

    const formData = new FormData()
    formData.append('bio', bio)
    formData.append('image_url', imageUrl)
    formData.append('specialties', specialties)

    startTransition(async () => {
      try {
        await updateTeacherProfile(formData)
        setSuccess(true)
        // Refresh profile data
        const data = await getTeacherProfile()
        if (data) {
          setProfile(data)
        }
      } catch (error) {
        console.error('Failed to update profile:', error)
      }
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground">Teacher profile not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">My Profile</h1>
        <p className="text-muted-foreground">
          Update your teacher profile information
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Profile Preview */}
        <Card>
          <CardHeader>
            <CardTitle>Profile Preview</CardTitle>
            <CardDescription>How students see your profile</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <Avatar className="w-24 h-24 mb-4">
              <AvatarImage src={imageUrl || profile.image_url} alt={profile.name} />
              <AvatarFallback className="text-2xl">
                {profile.name?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-bold mb-1">{profile.name}</h3>
            <p className="text-muted-foreground mb-3">{profile.instrument}</p>
            {(specialties || profile.specialties?.length > 0) && (
              <div className="flex flex-wrap gap-2 justify-center mb-4">
                {(specialties ? specialties.split(',').map((s: string) => s.trim()).filter(Boolean) : profile.specialties)?.map((specialty: string) => (
                  <Badge key={specialty} variant="secondary">
                    <Music className="w-3 h-3 mr-1" />
                    {specialty}
                  </Badge>
                ))}
              </div>
            )}
            {(bio || profile.bio) && (
              <p className="text-sm text-muted-foreground">
                {bio || profile.bio}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Edit Profile
            </CardTitle>
            <CardDescription>
              Update your bio, profile image, and specialties
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label className="text-muted-foreground">Name</Label>
                <p className="font-medium">{profile.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Contact an admin to change your name
                </p>
              </div>

              <div>
                <Label className="text-muted-foreground">Instrument</Label>
                <p className="font-medium">{profile.instrument}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Contact an admin to change your instrument
                </p>
              </div>

              <div>
                <Label htmlFor="image_url">Profile Image URL</Label>
                <Input
                  id="image_url"
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Enter a URL to your profile photo
                </p>
              </div>

              <div>
                <Label htmlFor="specialties">Specialties</Label>
                <Input
                  id="specialties"
                  value={specialties}
                  onChange={(e) => setSpecialties(e.target.value)}
                  placeholder="e.g., Salsa, Son Cubano, Timba"
                  className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Comma-separated list of your musical specialties
                </p>
              </div>

              <div>
                <Label htmlFor="bio">Bio</Label>
                <Textarea
                  id="bio"
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Tell students about your background and teaching style..."
                  rows={4}
                  className="mt-1"
                />
              </div>

              {success && (
                <div className="p-3 bg-green-500/10 text-green-600 rounded-lg text-sm">
                  Profile updated successfully!
                </div>
              )}

              <Button type="submit" disabled={isPending}>
                {isPending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Save className="w-4 h-4 mr-2" />
                )}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
