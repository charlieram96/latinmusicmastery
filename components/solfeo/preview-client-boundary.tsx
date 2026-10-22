'use client'

import { useSyncExternalStore, type ReactNode } from 'react'

const subscribe = () => () => {}
const mounted = () => true
const server = () => false

/** Local authoring previews hydrate once before mounting the shared dashboard.
 * Its async server slots otherwise receive different generated control IDs in
 * the preview route. The authenticated layout and its data remain server-owned.
 */
export function PreviewClientBoundary({ children }: { children: ReactNode }) {
  const ready = useSyncExternalStore(subscribe, mounted, server)
  return ready ? children : <div aria-busy="true" className="min-h-dvh bg-background" />
}
