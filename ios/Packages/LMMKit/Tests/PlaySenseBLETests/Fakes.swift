import CoreBluetooth

@testable import PlaySenseBLE

/// Fake `CBPeripheral` for `PlaySenseDeviceManagerTests` — CoreBluetooth's real `CBPeripheral` has no
/// public initializer, so a conformer to the shim protocol is the only way to drive
/// `PlaySenseDeviceManager`'s connect/discover/subscribe chain without live hardware.
@MainActor
final class FakePeripheral: PlaySenseBLEPeripheral {
    let identifier: UUID
    var name: String?
    private(set) var delegate: CBPeripheralDelegate?

    /// Plain struct (not a 3-member tuple — SwiftLint's `large_tuple` caps tuples at 2) recording one
    /// `setNotify(_:forCharacteristicUUID:inServiceWithUUID:)` call.
    struct SetNotifyCall: Equatable {
        let enabled: Bool
        let uuid: CBUUID
        let service: CBUUID
    }

    private(set) var discoverServicesCalls: [[CBUUID]?] = []
    private(set) var discoverCharacteristicsCalls: [(uuid: CBUUID, service: CBUUID)] = []
    private(set) var setNotifyCalls: [SetNotifyCall] = []

    init(identifier: UUID = UUID(), name: String? = "PlaySense") {
        self.identifier = identifier
        self.name = name
    }

    func setDelegate(_ delegate: CBPeripheralDelegate) {
        self.delegate = delegate
    }

    func discoverServices(_ serviceUUIDs: [CBUUID]?) {
        discoverServicesCalls.append(serviceUUIDs)
    }

    func discoverCharacteristics(uuid: CBUUID, inServiceWithUUID serviceUUID: CBUUID) {
        discoverCharacteristicsCalls.append((uuid, serviceUUID))
    }

    func setNotify(_ enabled: Bool, forCharacteristicUUID uuid: CBUUID, inServiceWithUUID serviceUUID: CBUUID) {
        setNotifyCalls.append(SetNotifyCall(enabled: enabled, uuid: uuid, service: serviceUUID))
    }
}

/// Fake `CBCentralManager` — the "CBCentralManager protocol shim" the D25 plan calls for, so scan/connect
/// state-machine logic is exercisable without real Bluetooth (inert on the Simulator anyway).
@MainActor
final class FakeCentralManager: PlaySenseBLECentralManaging {
    var state: CBManagerState = .poweredOn
    var retrievableByIdentifier: [UUID: any PlaySenseBLEPeripheral] = [:]

    private(set) var scanCalls = 0
    private(set) var stopScanCalls = 0
    private(set) var connectedIdentifiers: [UUID] = []
    private(set) var cancelConnectionIdentifiers: [UUID] = []

    func scanForPeripherals(withServices services: [CBUUID]?, options: [String: Any]?) {
        scanCalls += 1
    }

    func stopScan() {
        stopScanCalls += 1
    }

    func connect(_ peripheral: any PlaySenseBLEPeripheral) {
        connectedIdentifiers.append(peripheral.identifier)
    }

    func cancelConnection(_ peripheral: any PlaySenseBLEPeripheral) {
        cancelConnectionIdentifiers.append(peripheral.identifier)
    }

    func retrieveKnownPeripheral(withIdentifier identifier: UUID) -> (any PlaySenseBLEPeripheral)? {
        retrievableByIdentifier[identifier]
    }
}
