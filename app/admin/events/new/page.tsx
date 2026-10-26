import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AdminText } from '@/components/admin/admin-text'
import { NewEventForm } from '@/components/admin/events/new-event-form'

export default function NewEventPage() {
  return (
    <div className="mx-auto max-w-2xl p-6 lg:p-8">
      <Link href="/admin/events" className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> <AdminText text="Back to events" />
      </Link>
      <h1 className="mb-1 text-3xl font-bold tracking-tight"><AdminText text="New event" /></h1>
      <p className="mb-8 text-muted-foreground"><AdminText text="Start with the basics. You can add venue details, ticket types and the ticket design next." /></p>
      <NewEventForm />
    </div>
  )
}
