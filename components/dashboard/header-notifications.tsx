'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, BellDot, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { markNotificationRead, markAllNotificationsRead } from '@/app/actions/notifications'

interface Notification {
  id: string
  type: string
  title: string
  message: string
  href: string | null
  read: boolean
  created_at: string
}

interface HeaderNotificationsClientProps {
  notifications: Notification[]
  unreadCount: number
}

function timeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const seconds = Math.floor((now - then) / 1000)

  if (seconds < 60) return 'just now'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function HeaderNotificationsClient({ notifications: initialNotifications, unreadCount: initialUnread }: HeaderNotificationsClientProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState(initialNotifications)
  const [unreadCount, setUnreadCount] = useState(initialUnread)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read) {
      // Optimistic update
      setNotifications(prev =>
        prev.map(n => n.id === notification.id ? { ...n, read: true } : n)
      )
      setUnreadCount(prev => Math.max(0, prev - 1))
      startTransition(() => {
        markNotificationRead(notification.id)
      })
    }
    setOpen(false)
    if (notification.href) {
      router.push(notification.href)
    }
  }

  const handleMarkAllRead = () => {
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
    startTransition(() => {
      markAllNotificationsRead()
    })
  }

  const BellIcon = unreadCount > 0 ? BellDot : Bell
  const displayCount = unreadCount > 9 ? '9+' : unreadCount

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <BellIcon className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
              {displayCount}
            </span>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              Mark all read
            </button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">No notifications yet</p>
            </div>
          ) : (
            notifications.map((notification) => (
              <button
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className="flex w-full gap-3 px-4 py-3 text-left hover:bg-muted/50 transition-colors border-b last:border-b-0"
              >
                {/* Unread dot */}
                <div className="mt-1.5 shrink-0">
                  {!notification.read ? (
                    <span className="block h-2 w-2 rounded-full bg-primary" />
                  ) : (
                    <span className="block h-2 w-2" />
                  )}
                </div>
                {/* Content */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight">{notification.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{notification.message}</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo(notification.created_at)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
