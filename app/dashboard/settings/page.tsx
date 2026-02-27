import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  User,
  Bell,
  Lock,
  Globe,
  Trash2,
} from 'lucide-react'
import { ThemePreference } from '@/components/settings/theme-preference'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return (
    <>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Settings</h1>
        <p className="text-muted-foreground">
          Manage your account settings and preferences
        </p>
      </div>

      {/* Profile Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile Information
          </CardTitle>
          <CardDescription>
            Update your personal information
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="full_name">Full Name</Label>
              <Input
                id="full_name"
                defaultValue={profile?.full_name || ''}
                placeholder="Enter your full name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                defaultValue={user.email || ''}
                disabled
              />
              <p className="text-xs text-muted-foreground">
                Contact support to change your email
              </p>
            </div>
          </div>

          <Button>Save Changes</Button>
        </CardContent>
      </Card>

      {/* Notification Settings */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notifications
          </CardTitle>
          <CardDescription>
            Configure how you receive notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <p className="text-sm text-muted-foreground">
                Receive updates about new courses and features
              </p>
            </div>
            <Checkbox id="email-notifications" defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="course-reminders">Course Reminders</Label>
              <p className="text-sm text-muted-foreground">
                Get reminded to continue your in-progress courses
              </p>
            </div>
            <Checkbox id="course-reminders" defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="achievement-alerts">Achievement Alerts</Label>
              <p className="text-sm text-muted-foreground">
                Celebrate when you unlock new achievements
              </p>
            </div>
            <Checkbox id="achievement-alerts" defaultChecked />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="marketing-emails">Marketing Emails</Label>
              <p className="text-sm text-muted-foreground">
                Receive promotional offers and special deals
              </p>
            </div>
            <Checkbox id="marketing-emails" />
          </div>

          <Button>Update Preferences</Button>
        </CardContent>
      </Card>

      {/* Preferences */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Preferences
          </CardTitle>
          <CardDescription>
            Customize your learning experience
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Language</Label>
            <Select defaultValue="en">
              <SelectTrigger id="language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="es">Español</SelectItem>
                <SelectItem value="pt">Português</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select defaultValue="utc">
              <SelectTrigger id="timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utc">UTC</SelectItem>
                <SelectItem value="est">Eastern Time (ET)</SelectItem>
                <SelectItem value="pst">Pacific Time (PT)</SelectItem>
                <SelectItem value="cet">Central European Time (CET)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <ThemePreference />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autoplay">Autoplay Next Lesson</Label>
              <p className="text-sm text-muted-foreground">
                Automatically start the next lesson when one finishes
              </p>
            </div>
            <Checkbox id="autoplay" defaultChecked />
          </div>

          <Button>Save Preferences</Button>
        </CardContent>
      </Card>

      {/* Security */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5" />
            Security
          </CardTitle>
          <CardDescription>
            Manage your account security
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Password</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Keep your account secure with a strong password
            </p>
            <Button variant="outline">Change Password</Button>
          </div>

          <Separator />

          <div>
            <Label>Two-Factor Authentication</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Add an extra layer of security to your account
            </p>
            <Button variant="outline">Enable 2FA</Button>
          </div>

          <Separator />

          <div>
            <Label>Active Sessions</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Manage devices where you're logged in
            </p>
            <Button variant="outline">View Sessions</Button>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Irreversible actions for your account
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Delete Account</Label>
            <p className="text-sm text-muted-foreground mb-3">
              Permanently delete your account and all associated data
            </p>
            <Button variant="destructive">Delete Account</Button>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
