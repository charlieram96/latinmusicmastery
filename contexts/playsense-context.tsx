'use client'

import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react'

const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc'
const CHARACTERISTIC_UUID = 'abcd1234-5678-1234-5678-abcdef123456'

export interface PlaysenseReading {
  piezos: number[]
  mic: number
  receivedAt: number
}

export type PlaysenseConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting'
  | 'error'

interface PlaysenseContextType {
  connectionStatus: PlaysenseConnectionStatus
  isSupported: boolean
  error: string | null
  lastReading: PlaysenseReading | null
  /** performance.now() value of the most recent valid reading, or null. */
  lastReceivedAt: number | null
  connect: () => Promise<void>
  disconnect: () => void
}

const PlaysenseContext = createContext<PlaysenseContextType | null>(null)

export function PlaysenseProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<PlaysenseConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [lastReading, setLastReading] = useState<PlaysenseReading | null>(null)
  const [lastReceivedAt, setLastReceivedAt] = useState<number | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  const deviceRef = useRef<BluetoothDevice | null>(null)
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  /** True when the user is in an "active session" (e.g. exercise running) — autoreconnect should fire here. */
  const wantConnectedRef = useRef<boolean>(false)
  const reconnectAttemptsRef = useRef(0)

  useEffect(() => {
    setIsSupported(typeof navigator !== 'undefined' && 'bluetooth' in navigator)
  }, [])

  const handleNotification = useCallback((event: Event) => {
    try {
      const target = event.target as BluetoothRemoteGATTCharacteristic
      const text = new TextDecoder().decode(target.value!)
      const data = JSON.parse(text)
      if (Array.isArray(data.piezos)) {
        const now = performance.now()
        setLastReading({
          piezos: data.piezos,
          mic: Number(data.mic) || 0,
          receivedAt: now,
        })
        setLastReceivedAt(now)
      }
    } catch {
      // Ignore malformed data
    }
  }, [])

  const connectInternal = useCallback(async (askForDevice: boolean): Promise<void> => {
    if (!isSupported) {
      setError('Web Bluetooth is not supported in this browser. Please use Chrome or Edge.')
      setConnectionStatus('error')
      return
    }

    setError(null)

    let device = deviceRef.current
    if (askForDevice || !device) {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'PlaySense' }],
        optionalServices: [SERVICE_UUID],
      })
      deviceRef.current = device
    }

    if (!device.gatt) {
      throw new Error('PlaySense device does not support GATT')
    }

    const server = await device.gatt.connect()
    const service = await server.getPrimaryService(SERVICE_UUID)
    const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID)

    await characteristic.startNotifications()
    characteristic.addEventListener('characteristicvaluechanged', handleNotification)
    characteristicRef.current = characteristic

    setConnectionStatus('connected')
    reconnectAttemptsRef.current = 0
  }, [isSupported, handleNotification])

  const onDisconnected = useCallback(async () => {
    characteristicRef.current = null

    // If the user wants to stay connected, attempt one auto-reconnect.
    if (wantConnectedRef.current && reconnectAttemptsRef.current < 1) {
      reconnectAttemptsRef.current++
      setConnectionStatus('reconnecting')
      try {
        await connectInternal(false)
      } catch {
        setError('PlaySense device disconnected and could not reconnect.')
        setConnectionStatus('error')
      }
    } else {
      setConnectionStatus('disconnected')
    }
  }, [connectInternal])

  const connect = useCallback(async () => {
    setConnectionStatus('connecting')
    setError(null)
    wantConnectedRef.current = true
    reconnectAttemptsRef.current = 0

    try {
      // We always pop the device picker on the first connect of a session — but we'll
      // re-use the device for auto-reconnect.
      let device = deviceRef.current
      if (!device) {
        device = await navigator.bluetooth.requestDevice({
          filters: [{ name: 'PlaySense' }],
          optionalServices: [SERVICE_UUID],
        })
        deviceRef.current = device
        device.addEventListener('gattserverdisconnected', onDisconnected)
      }
      await connectInternal(false)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect to PlaySense device'
      if (message.toLowerCase().includes('cancel')) {
        setConnectionStatus('disconnected')
        return
      }
      setError(message)
      setConnectionStatus('error')
    }
  }, [connectInternal, onDisconnected])

  const disconnect = useCallback(() => {
    wantConnectedRef.current = false
    if (characteristicRef.current) {
      characteristicRef.current.removeEventListener('characteristicvaluechanged', handleNotification)
      characteristicRef.current = null
    }
    if (deviceRef.current && deviceRef.current.gatt?.connected) {
      deviceRef.current.gatt.disconnect()
    }
    setConnectionStatus('disconnected')
    setLastReading(null)
    setLastReceivedAt(null)
    setError(null)
  }, [handleNotification])

  useEffect(() => {
    return () => {
      if (characteristicRef.current) {
        characteristicRef.current.removeEventListener('characteristicvaluechanged', handleNotification)
      }
      if (deviceRef.current && deviceRef.current.gatt?.connected) {
        deviceRef.current.gatt.disconnect()
      }
    }
  }, [handleNotification])

  return (
    <PlaysenseContext.Provider
      value={{ connectionStatus, isSupported, error, lastReading, lastReceivedAt, connect, disconnect }}
    >
      {children}
    </PlaysenseContext.Provider>
  )
}

export function usePlaysense() {
  const context = useContext(PlaysenseContext)
  if (!context) {
    throw new Error('usePlaysense must be used within a PlaysenseProvider')
  }
  return context
}
