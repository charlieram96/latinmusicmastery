'use client'

import { Settings2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ClassItem } from '@/types/modules'
import styles from './course-studio.module.css'
import { itemMeta } from './item-meta'

interface StudioDrawerProps {
  open: boolean
  widthPx: number
  onClose: () => void
  mode: 'item' | 'settings' | null
  item: ClassItem | null
  children: React.ReactNode
}

/** In-page push drawer: part of the flex row, animating its width so the
    canvas yields space instead of being covered. Below lg it becomes a
    fixed overlay (see course-studio.module.css). */
export function StudioDrawer({ open, widthPx, onClose, mode, item, children }: StudioDrawerProps) {
  const meta = mode === 'item' && item ? itemMeta(item.item_type) : null
  const Icon = meta?.icon

  return (
    <aside
      className={cn(styles.drawer, 'bg-card', open && 'border-l border-border')}
      aria-hidden={!open}
    >
      <div className={styles.drawerInner} style={{ width: widthPx }}>
        <div className="flex h-full flex-col">
          <header className="flex h-12 flex-shrink-0 items-center gap-2.5 border-b border-border px-4">
            {mode === 'settings' ? (
              <>
                <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Settings2 className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-semibold text-foreground">
                    Course settings
                  </p>
                </div>
              </>
            ) : meta && Icon ? (
              <>
                <span
                  className={cn(
                    'flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg',
                    meta.bg,
                    meta.fg
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[9.5px] font-semibold uppercase leading-3 tracking-[0.14em] text-muted-foreground/70">
                    {meta.label}
                  </p>
                  <p className="truncate text-[13px] font-semibold leading-4 text-foreground">
                    {item?.title || 'Untitled'}
                  </p>
                </div>
              </>
            ) : (
              <div className="flex-1" />
            )}
            <button
              type="button"
              onClick={onClose}
              title="Close"
              className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
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
