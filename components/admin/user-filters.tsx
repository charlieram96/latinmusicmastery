'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search } from 'lucide-react'

export function UserFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const params = new URLSearchParams()

    const search = formData.get('search') as string
    const status = formData.get('status') as string
    const plan = formData.get('plan') as string

    if (search) params.set('search', search)
    if (status && status !== 'all') params.set('status', status)
    if (plan && plan !== 'all') params.set('plan', plan)

    router.push(`/admin/users?${params.toString()}`)
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap gap-4">
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            name="search"
            placeholder="Search by name or email..."
            defaultValue={searchParams.get('search') || ''}
            className="pl-10"
          />
        </div>
      </div>
      <select
        name="status"
        defaultValue={searchParams.get('status') || 'all'}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="all">All Users</option>
        <option value="subscribed">Subscribed</option>
        <option value="free">Free</option>
      </select>
      <select
        name="plan"
        defaultValue={searchParams.get('plan') || 'all'}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm"
      >
        <option value="all">All Plans</option>
        <option value="instrument">Instrument</option>
        <option value="all_access">All-Access</option>
      </select>
      <Button type="submit">Search</Button>
    </form>
  )
}
