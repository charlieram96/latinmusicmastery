'use client'

import { useCallback, useEffect, useRef } from 'react'

interface UseAutosaveOptions<TPatch extends object> {
  save: (patch: TPatch) => Promise<unknown>
  delay?: number
}

/**
 * Debounced patch accumulator for autosaving form fields.
 *
 * - `queue(patch)` merges into the pending patch and (re)starts the debounce timer.
 * - `saveNow(patch?)` merges and fires immediately (toggles, selects, upload URLs).
 * - `flush()` fires whatever is pending right away.
 *
 * Saves are serialized through an internal promise chain so patches for the
 * same entity always reach the server in order. Pending edits are flushed on
 * unmount, so keying the consuming editor by entity id makes switching
 * entities mid-debounce safe.
 */
export function useAutosave<TPatch extends object>({
  save,
  delay = 800,
}: UseAutosaveOptions<TPatch>) {
  const pendingRef = useRef<TPatch | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const chainRef = useRef<Promise<unknown>>(Promise.resolve())
  const saveRef = useRef(save)
  saveRef.current = save

  const fire = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const patch = pendingRef.current
    pendingRef.current = null
    if (!patch) return
    chainRef.current = chainRef.current
      .then(() => saveRef.current(patch))
      .catch(() => {
        // Failures surface through the save-status indicator; keep the chain alive.
      })
  }, [])

  const queue = useCallback(
    (patch: Partial<TPatch>) => {
      pendingRef.current = { ...(pendingRef.current ?? ({} as TPatch)), ...patch } as TPatch
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(fire, delay)
    },
    [delay, fire]
  )

  const saveNow = useCallback(
    (patch?: Partial<TPatch>) => {
      if (patch) {
        pendingRef.current = { ...(pendingRef.current ?? ({} as TPatch)), ...patch } as TPatch
      }
      fire()
    },
    [fire]
  )

  // Flush pending edits when the editor unmounts (entity switch, drawer close).
  useEffect(() => fire, [fire])

  return { queue, saveNow, flush: fire }
}
