'use client'

import { createContext, useContext, useState, useRef, useCallback, useEffect, ReactNode } from 'react'

const SERVICE_UUID = '12345678-1234-1234-1234-123456789abc'
const CHARACTERISTIC_UUID = 'abcd1234-5678-1234-5678-abcdef123456'

export interface PlaysenseReading {
  piezos: number[]
  mic: number
  receivedAt: number
}

export type PlaysenseConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'error'

interface PlaysenseContextType {
  connectionStatus: PlaysenseConnectionStatus
  isSupported: boolean
  error: string | null
  lastReading: PlaysenseReading | null
  connect: () => Promise<void>
  disconnect: () => void
}

const PlaysenseContext = createContext<PlaysenseContextType | null>(null)

export function PlaysenseProvider({ children }: { children: ReactNode }) {
  const [connectionStatus, setConnectionStatus] = useState<PlaysenseConnectionStatus>('disconnected')
  const [error, setError] = useState<string | null>(null)
  const [lastReading, setLastReading] = useState<PlaysenseReading | null>(null)
  const [isSupported, setIsSupported] = useState(false)

  const deviceRef = useRef<BluetoothDevice | null>(null)
  const characteristicRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)

  useEffect(() => {
    setIsSupported(typeof navigator !== 'undefined' && 'bluetooth' in navigator)
  }, [])

  const handleNotification = useCallback((event: Event) => {
    try {
      const target = event.target as BluetoothRemoteGATTCharacteristic
      const text = new TextDecoder().decode(target.value!)
      const data = JSON.parse(text)
      if (Array.isArray(data.piezos)) {
        setLastReading({
          piezos: data.piezos,
          mic: Number(data.mic) || 0,
          receivedAt: performance.now(),
        })
      }
    } catch {
      // Ignore malformed data
    }
  }, [])

  const onDisconnected = useCallback(() => {
    setConnectionStatus('disconnected')
    characteristicRef.current = null
  }, [])

  const connect = useCallback(async () => {
    if (!isSupported) {
      setError('Web Bluetooth is not supported in this browser. Please use Chrome or Edge.')
      setConnectionStatus('error')
      return
    }

    setError(null)
    setConnectionStatus('connecting')

    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ name: 'PlaySense' }],
        optionalServices: [SERVICE_UUID],
      })

      deviceRef.current = device
      device.addEventListener('gattserverdisconnected', onDisconnected)

      const server = await device.gatt!.connect()
      const service = await server.getPrimaryService(SERVICE_UUID)
      const characteristic = await service.getCharacteristic(CHARACTERISTIC_UUID)

      await characteristic.startNotifications()
      characteristic.addEventListener('characteristicvaluechanged', handleNotification)
      characteristicRef.current = characteristic

      setConnectionStatus('connected')
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to connect to PlaySense device'
      if (message.includes('cancelled') || message.includes('canceled')) {
        setConnectionStatus('disconnected')
        return
      }
      setError(message)
      setConnectionStatus('error')
    }
  }, [isSupported, onDisconnected, handleNotification])

  const disconnect = useCallback(() => {
    if (characteristicRef.current) {
      characteristicRef.current.removeEventListener('characteristicvaluechanged', handleNotification)
      characteristicRef.current = null
    }
    if (deviceRef.current && deviceRef.current.gatt?.connected) {
      deviceRef.current.gatt.disconnect()
    }
    setConnectionStatus('disconnected')
    setLastReading(null)
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
      value={{ connectionStatus, isSupported, error, lastReading, connect, disconnect }}
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
