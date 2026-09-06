'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { markNotificationRead, markAllNotificationsRead } from '@/app/actions/notifications'
import { useTranslation } from '@/components/language-provider'
import { timeAgo } from '@/lib/time-ago'

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

export function HeaderNotificationsClient({ notifications: initialNotifications, unreadCount: initialUnread }: HeaderNotificationsClientProps) {
  const router = useRouter()
  const [notifications, setNotifications] = useState(initialNotifications)
  const [unreadCount, setUnreadCount] = useState(initialUnread)
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const { t, locale } = useTranslation()

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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="relative text-muted-foreground hover:text-foreground"
          aria-label={
            unreadCount > 0
              ? `${t('dashboard.header.notifications.title')} (${unreadCount})`
              : t('dashboard.header.notifications.title')
          }
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span
              aria-hidden
              className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background"
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-80 rounded-lg p-0 shadow-pop">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{t('dashboard.header.notifications.title')}</h3>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              disabled={isPending}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <Check className="h-3 w-3" />
              {t('dashboard.header.notifications.markAllRead')}
            </button>
          )}
        </div>

        {/* Notification list */}
        <div className="max-h-80 overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Bell className="h-8 w-8 mb-2 opacity-40" />
              <p className="text-sm">{t('dashboard.header.notifications.empty')}</p>
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
                  <p className="text-xs text-muted-foreground/60 mt-1">{timeAgo(notification.created_at, locale)}</p>
                </div>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
