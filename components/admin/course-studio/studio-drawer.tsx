'use client'
import { AdminText } from '@/components/admin/admin-text'


import { X } from 'lucide-react'
import { cn } from '@/lib/utils'
import styles from './course-studio.module.css'

interface StudioDrawerHeader {
  label?: string
  title: string
  icon: React.ReactNode
}

interface StudioDrawerProps {
  widthPx: number
  header: StudioDrawerHeader
  /** Closes the mobile overlay; the panel is always open on desktop. */
  onMobileClose: () => void
  children: React.ReactNode
}

/** Always-open inspector panel: part of the flex row on desktop (its width
    animates so the canvas yields space), and a slide-in overlay below lg
    (see course-studio.module.css). Filled with the current selection's editor. */
export function StudioDrawer({ widthPx, header, onMobileClose, children }: StudioDrawerProps) {
  return (
    <aside className={cn(styles.drawer, 'border-l border-border bg-card')}>
      <div className={styles.drawerInner} style={{ width: widthPx }}>
        <div className="flex h-full flex-col">
          <header className="flex h-12 flex-shrink-0 items-center gap-2.5 border-b border-border px-4">
            {header.icon}
            <div className="min-w-0 flex-1">
              {header.label && (
                <p className="text-[9.5px] font-semibold uppercase leading-3 tracking-[0.14em] text-muted-foreground/70">
                  {<AdminText text={header.label} />}
                </p>
              )}
              <p className="truncate text-[13px] font-semibold leading-4 text-foreground">
                {header.title}
              </p>
            </div>
            <button
              type="button"
              onClick={onMobileClose}
              title="Close"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground lg:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div className={`${styles.scrollHide} flex-1 overflow-y-auto`}>{children}</div>
        </div>
      </div>
    </aside>
  )
}
