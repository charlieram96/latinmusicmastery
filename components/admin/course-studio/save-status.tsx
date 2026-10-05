'use client'

import { AdminText } from '@/components/admin/admin-text'


import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { Check, CloudUpload, TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/utils'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface SaveStatusValue {
  state: SaveState
  errorMessage: string | null
  /** Wrap any persistence promise so the app-bar indicator reflects it.
      Resolved values shaped `{ error: string }` are treated as failures. */
  track: <T>(promise: Promise<T>) => Promise<T>
}

const SaveStatusContext = createContext<SaveStatusValue | null>(null)

export function SaveStatusProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SaveState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const pendingRef = useRef(0)

  const track = useCallback(<T,>(promise: Promise<T>): Promise<T> => {
    pendingRef.current += 1
    setState('saving')

    const settle = (failure: string | null) => {
      pendingRef.current -= 1
      if (failure) {
        setErrorMessage(failure)
        if (pendingRef.current === 0) setState('error')
        return
      }
      if (pendingRef.current === 0) {
        setErrorMessage(null)
        setState('saved')
      }
    }

    return promise.then(
      (value) => {
        const failure =
          value && typeof value === 'object' && 'error' in value && (value as { error?: unknown }).error
            ? String((value as { error: unknown }).error)
            : null
        settle(failure)
        return value
      },
      (err) => {
        settle(err instanceof Error ? err.message : 'Something went wrong')
        throw err
      }
    )
  }, [])

  const value = useMemo(() => ({ state, errorMessage, track }), [state, errorMessage, track])

  return <SaveStatusContext.Provider value={value}>{children}</SaveStatusContext.Provider>
}

export function useSaveStatus() {
  const ctx = useContext(SaveStatusContext)
  if (!ctx) throw new Error('useSaveStatus must be used within a SaveStatusProvider')
  return ctx
}

export function SaveIndicator() {
  const { state, errorMessage } = useSaveStatus()

  if (state === 'idle') return null

  return (
    <div
      title={state === 'error' ? errorMessage ?? undefined : undefined}
      className={cn(
        'flex items-center gap-1.5 text-xs tabular-nums transition-colors duration-300',
        state === 'saving' && 'text-muted-foreground',
        state === 'saved' && 'text-muted-foreground/70',
        state === 'error' && 'text-destructive'
      )}
    >
      {state === 'saving' && (
        <>
          <CloudUpload className="h-3.5 w-3.5 animate-pulse" />
          <span><AdminText text={"Saving…"} /></span>
        </>
      )}
      {state === 'saved' && (
        <>
          <Check className="h-3.5 w-3.5" />
          <span><AdminText text={"Saved"} /></span>
        </>
      )}
      {state === 'error' && (
        <>
          <TriangleAlert className="h-3.5 w-3.5" />
          <span>{errorMessage ? `Couldn’t save — ${errorMessage}` : 'Couldn’t save'}</span>
        </>
      )}
    </div>
  )
}
