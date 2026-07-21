import CoreBluetooth

/// The real `CBCentralManagerDelegate`/`CBPeripheralDelegate` conformances for ``PlaySenseDeviceManager`` —
/// split into its own file (fix round 1 for D25's review: `PlaySenseDeviceManager.swift` grew past
/// SwiftLint's `file_length` cap once the scan-timeout fix landed) purely to stay under that cap, same
/// reason `StagePlayerView+PlaysenseMode.swift`/`CalibrationWizardView+Errors.swift` split their content
/// out; no behavioral significance. See ``PlaySenseDeviceManager``'s module doc for the untested-glue
/// inventory these conformances are part of (each is a thin extract-and-forward into a `handle*` method).
extension PlaySenseDeviceManager: CBCentralManagerDelegate {
    /// `nonisolated` + `MainActor.assumeIsolated`: `CBCentralManager(delegate:queue: nil)` guarantees
    /// every delegate callback arrives on the main queue, so it's safe to synchronously re-enter this
    /// `@MainActor` instance here (same pattern as `AudioSessionController`'s NotificationCenter
    /// observers) instead of hopping through an async `Task`.
    public nonisolated func centralManagerDidUpdateState(_ central: CBCentralManager) {
        MainActor.assumeIsolated { self.handleCentralStateUpdate(central.state) }
    }

    public nonisolated func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String: Any],
        rssi RSSI: NSNumber
    ) {
        MainActor.assumeIsolated {
            self.handleDiscovered(peripheral: peripheral, advertisementData: advertisementData)
        }
    }

    public nonisolated func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        MainActor.assumeIsolated { self.handleConnected(peripheral: peripheral) }
    }

    public nonisolated func centralManager(
        _ central: CBCentralManager, didFailToConnect peripheral: CBPeripheral, error: Error?
    ) {
        MainActor.assumeIsolated { self.handleFailedToConnect(peripheral: peripheral, error: error) }
    }

    public nonisolated func centralManager(
        _ central: CBCentralManager, didDisconnectPeripheral peripheral: CBPeripheral, error: Error?
    ) {
        MainActor.assumeIsolated { self.handleDisconnected(peripheral: peripheral) }
    }
}

extension PlaySenseDeviceManager: CBPeripheralDelegate {
    public nonisolated func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        let uuids = error == nil ? (peripheral.services ?? []).map(\.uuid) : []
        MainActor.assumeIsolated { self.handleDiscoveredServiceUUIDs(uuids, peripheral: peripheral) }
    }

    public nonisolated func peripheral(
        _ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?
    ) {
        let uuids = error == nil ? (service.characteristics ?? []).map(\.uuid) : []
        MainActor.assumeIsolated { self.handleDiscoveredCharacteristicUUIDs(uuids, peripheral: peripheral) }
    }

    public nonisolated func peripheral(
        _ peripheral: CBPeripheral, didUpdateNotificationStateFor characteristic: CBCharacteristic, error: Error?
    ) {
        let isNotifying = error == nil && characteristic.isNotifying
        MainActor.assumeIsolated {
            self.handleNotificationStateUpdate(isNotifying: isNotifying, peripheral: peripheral)
        }
    }

    public nonisolated func peripheral(
        _ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?
    ) {
        guard error == nil else { return }
        let uuid = characteristic.uuid
        let data = characteristic.value
        MainActor.assumeIsolated { self.handleCharacteristicValueUpdate(uuid: uuid, data: data) }
    }
}
