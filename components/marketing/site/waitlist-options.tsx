'use client'

import { createContext, useContext } from 'react'

export type Option = { id: string; name: string }
const Ctx = createContext<{ instruments: Option[]; styles: Option[] }>({ instruments: [], styles: [] })

/** Supplies the waitlist modal's instrument/style choices to every WaitlistSignup under the marketing layout. */
export function WaitlistOptionsProvider({ instruments, styles, children }: { instruments: Option[]; styles: Option[]; children: React.ReactNode }) {
  return <Ctx.Provider value={{ instruments, styles }}>{children}</Ctx.Provider>
}

export const useWaitlistOptions = () => useContext(Ctx)
