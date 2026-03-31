// Minimal Web Bluetooth API type declarations
interface BluetoothDevice extends EventTarget {
  readonly name: string | undefined
  readonly gatt: BluetoothRemoteGATTServer | undefined
}

interface BluetoothRemoteGATTServer {
  readonly connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly value: DataView | undefined
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
}

interface Bluetooth {
  requestDevice(options: { filters?: Array<{ name?: string }>; optionalServices?: string[] }): Promise<BluetoothDevice>
}

interface Navigator {
  readonly bluetooth: Bluetooth
}
