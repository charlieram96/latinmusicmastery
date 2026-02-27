'use client'

import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  ArrowLeft,
  User,
  Shield,
  GraduationCap,
  CreditCard,
  Save,
  Loader2,
  Link as LinkIcon,
  Unlink,
  Crown,
  Music,
} from 'lucide-react'
import {
  getUser,
  updateUserProfile,
  promoteUserToTeacher,
  removeTeacherAccess
} from '@/app/actions/admin'
import { createClient } from '@/lib/supabase/client'

interface UserDetailPageProps {
  params: Promise<{ id: string }>
}

export default function UserDetailPage({ params }: UserDetailPageProps) {
  const [isPending, startTransition] = useTransition()
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [teachers, setTeachers] = useState<any[]>([])
  const [selectedTeacherId, setSelectedTeacherId] = useState('')
  const [fullName, setFullName] = useState('')
  const [isAdmin, setIsAdmin] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    async function loadData() {
      const { id } = await params
      const userData = await getUser(id)
      setUser(userData)
      setFullName(userData.full_name || '')
      setIsAdmin(userData.is_admin || false)

      // Load available teachers
      const supabase = createClient()
      const { data: teacherData } = await supabase
        .from('teachers')
        .select('id, name, instrument, user_id')
        .order('name')
      setTeachers(teacherData || [])

      setLoading(false)
    }
    loadData()
  }, [params])

  const handleSave = async () => {
    if (!user) return
    setSuccess('')

    const formData = new FormData()
    formData.append('full_name', fullName)
    formData.append('is_admin', isAdmin.toString())

    startTransition(async () => {
      try {
        await updateUserProfile(user.id, formData)
        setSuccess('Profile updated successfully')
        const { id } = await params
        const updatedUser = await getUser(id)
        setUser(updatedUser)
      } catch (error) {
        console.error('Failed to update profile:', error)
      }
    })
  }

  const handleLinkTeacher = async () => {
    if (!user || !selectedTeacherId) return
    setSuccess('')

    startTransition(async () => {
      try {
        await promoteUserToTeacher(user.id, selectedTeacherId)
        setSuccess('User linked to teacher profile')
        const { id } = await params
        const updatedUser = await getUser(id)
        setUser(updatedUser)
        setSelectedTeacherId('')
      } catch (error) {
        console.error('Failed to link teacher:', error)
      }
    })
  }

  const handleUnlinkTeacher = async (teacherId: string) => {
    setSuccess('')

    startTransition(async () => {
      try {
        await removeTeacherAccess(teacherId)
        setSuccess('Teacher access removed')
        const { id } = await params
        const updatedUser = await getUser(id)
        setUser(updatedUser)
      } catch (error) {
        console.error('Failed to unlink teacher:', error)
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

  if (!user) {
    return (
      <div className="container mx-auto px-6 py-8">
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">User not found</p>
          <Button asChild>
            <Link href="/admin/users">Back to Users</Link>
          </Button>
        </div>
      </div>
    )
  }

  const linkedTeacher = user.teachers?.[0]
  const availableTeachers = teachers.filter(t => !t.user_id || t.user_id === user.id)
  const activeSubs = (user.subscriptions || []).filter((s: any) => s.status === 'active')

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-6">
        <Button asChild variant="ghost" size="sm" className="mb-4">
          <Link href="/admin/users">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Users
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">User Details</h1>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* User Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center text-center">
            <Avatar className="w-20 h-20 mb-4">
              <AvatarImage src={user.avatar_url} alt={user.full_name} />
              <AvatarFallback className="text-2xl">
                {user.email?.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <h3 className="text-xl font-bold mb-1">{user.full_name || 'No name'}</h3>
            <p className="text-muted-foreground mb-3">{user.email}</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {user.is_admin && (
                <Badge variant="destructive">
                  <Shield className="w-3 h-3 mr-1" />
                  Admin
                </Badge>
              )}
              {linkedTeacher && (
                <Badge variant="secondary">
                  <GraduationCap className="w-3 h-3 mr-1" />
                  Teacher
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-4">
              Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </p>
          </CardContent>
        </Card>

        {/* Edit Form */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Edit User</CardTitle>
            <CardDescription>Update user settings and permissions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <Shield className="w-5 h-5 text-destructive" />
                <div>
                  <p className="font-medium">Admin Access</p>
                  <p className="text-sm text-muted-foreground">
                    Grant full administrative privileges
                  </p>
                </div>
              </div>
              <Switch
                checked={isAdmin}
                onCheckedChange={setIsAdmin}
              />
            </div>

            {success && (
              <div className="p-3 bg-green-500/10 text-green-600 rounded-lg text-sm">
                {success}
              </div>
            )}

            <Button onClick={handleSave} disabled={isPending}>
              {isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Changes
            </Button>
          </CardContent>
        </Card>

        {/* Teacher Link */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              Teacher Access
            </CardTitle>
            <CardDescription>
              Link this user to a teacher profile to grant teacher portal access
            </CardDescription>
          </CardHeader>
          <CardContent>
            {linkedTeacher ? (
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <p className="font-medium">{linkedTeacher.name}</p>
                  <p className="text-sm text-muted-foreground">{linkedTeacher.instrument}</p>
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleUnlinkTeacher(linkedTeacher.id)}
                  disabled={isPending}
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Unlink className="w-4 h-4 mr-2" />
                  )}
                  Remove Access
                </Button>
              </div>
            ) : (
              <div className="flex gap-4">
                <select
                  value={selectedTeacherId}
                  onChange={(e) => setSelectedTeacherId(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-md border bg-background text-sm"
                >
                  <option value="">Select a teacher profile...</option>
                  {availableTeachers.map((teacher) => (
                    <option key={teacher.id} value={teacher.id}>
                      {teacher.name} - {teacher.instrument}
                      {teacher.user_id === user.id ? ' (Currently linked)' : ''}
                    </option>
                  ))}
                </select>
                <Button
                  onClick={handleLinkTeacher}
                  disabled={isPending || !selectedTeacherId}
                >
                  {isPending ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <LinkIcon className="w-4 h-4 mr-2" />
                  )}
                  Link
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Subscription Info */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Subscriptions
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activeSubs.length > 0 ? (
              <div className="space-y-4">
                {activeSubs.map((sub: any) => (
                  <div key={sub.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-2">
                      {sub.plan_type === 'all_access' ? (
                        <Crown className="w-4 h-4 text-primary" />
                      ) : (
                        <Music className="w-4 h-4" />
                      )}
                      <div>
                        <p className="font-medium text-sm">
                          {sub.plan_type === 'all_access' ? 'All-Access' : sub.instrument}
                        </p>
                        {sub.current_period_end && (
                          <p className="text-xs text-muted-foreground">
                            Renews {new Date(sub.current_period_end).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="default" className="capitalize text-xs">
                      {sub.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No active subscriptions</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
