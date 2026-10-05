import type { CenterSelection, DrawerSelection, SectionWithClasses } from './types'

export interface InitialSelectionRequest {
  /** Lesson (class) to open in the center, e.g. from `?class=` in the URL. */
  classId?: string | null
  /** Item within that lesson to select in the drawer, e.g. from `?item=`. */
  itemId?: string | null
}

export interface InitialSelection {
  center: CenterSelection
  drawer: DrawerSelection
}

/**
 * Decide what the course studio shows on first render.
 *
 * A requested lesson (and optionally an item inside it) wins when it exists
 * in the course. Otherwise leave the canvas and inspector unselected.
 */
export function resolveInitialSelection(
  sections: SectionWithClasses[],
  request: InitialSelectionRequest = {}
): InitialSelection {
  if (request.classId) {
    for (const section of sections) {
      const cls = section.classes.find((c) => c.id === request.classId)
      if (!cls) continue
      const hasItem = !!request.itemId && cls.items.some((i) => i.id === request.itemId)
      return {
        center: { type: 'class', id: cls.id },
        drawer: hasItem ? { type: 'item', id: request.itemId! } : { type: 'class', id: cls.id },
      }
    }
  }

  return { center: null, drawer: { type: 'none' } }
}
