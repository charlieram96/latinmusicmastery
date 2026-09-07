'use client'

import Link from 'next/link'
import { CircleHelp, CreditCard, GraduationCap, LogOut, Shield, TrendingUp, UserRound } from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useTranslation } from '@/components/language-provider'
import { signOut } from '@/app/actions/auth'
import { initialsFor } from '@/lib/dashboard/initials'

interface AccountMenuProps {
  name: string
  email: string
  avatarUrl: string | null
  hasSubscription: boolean
  isAdmin: boolean
  isTeacher: boolean
}

export function AccountMenu({ name, email, avatarUrl, hasSubscription, isAdmin, isTeacher }: AccountMenuProps) {
  const { t } = useTranslation()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={t('dashboard.header.account.open')}
          className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Avatar className="h-9 w-9">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt={name || email} /> : null}
            <AvatarFallback className="text-sm">{initialsFor(name, email)}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-64 rounded-lg p-1.5 shadow-pop">
        <div className="flex items-center gap-3 px-2 py-2">
          <Avatar className="h-9 w-9">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback className="text-sm">{initialsFor(name, email)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">{name || email.split('@')[0]}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
          </div>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <UserRound />
            {t('dashboard.header.account.profile')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/subscription">
            <CreditCard />
            {t('dashboard.header.account.plan')}
            <span className="ml-auto text-xs text-muted-foreground">
              {hasSubscription ? t('dashboard.nav.plan.active') : t('dashboard.nav.plan.free')}
            </span>
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard/progress">
            <TrendingUp />
            {t('dashboard.header.account.progress')}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/help">
            <CircleHelp />
            {t('dashboard.header.account.help')}
          </Link>
        </DropdownMenuItem>
        {isTeacher && (
          <DropdownMenuItem asChild>
            <Link href="/teacher">
              <GraduationCap />
              {t('dashboard.nav.teacherPortal')}
            </Link>
          </DropdownMenuItem>
        )}
        {isAdmin && (
          <DropdownMenuItem asChild>
            <Link href="/admin">
              <Shield />
              {t('dashboard.nav.adminPanel')}
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onSelect={() => void signOut()} className="cursor-pointer">
          <LogOut />
          {t('common.signOut')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
