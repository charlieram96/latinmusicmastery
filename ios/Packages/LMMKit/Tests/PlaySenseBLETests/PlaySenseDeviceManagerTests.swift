import CoreBluetooth
import XCTest

@testable import PlaySenseBLE

@MainActor
final class PlaySenseDeviceManagerTests: XCTestCase {

    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "PlaySenseDeviceManagerTests")
        defaults.removePersistentDomain(forName: "PlaySenseDeviceManagerTests")
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: "PlaySenseDeviceManagerTests")
        defaults = nil
        super.tearDown()
    }

    private func makeManager(central: FakeCentralManager) -> PlaySenseDeviceManager {
        PlaySenseDeviceManager(central: central, defaults: defaults)
    }

    // MARK: - Central state → typed statuses

    func testPoweredOffProducesTypedErrorMessage() {
        let manager = makeManager(central: FakeCentralManager())
        manager.handleCentralStateUpdate(.poweredOff)
        XCTAssertEqual(manager.connectionStatus, .error)
        XCTAssertEqual(manager.errorMessage, PlaySenseBLEErrorMessage.bluetoothPoweredOff)
    }

    func testUnauthorizedProducesTypedErrorMessage() {
        let manager = makeManager(central: FakeCentralManager())
        manager.handleCentralStateUpdate(.unauthorized)
        XCTAssertEqual(manager.connectionStatus, .error)
        XCTAssertEqual(manager.errorMessage, PlaySenseBLEErrorMessage.bluetoothUnauthorized)
    }

    func testUnsupportedProducesTypedErrorMessage() {
        let manager = makeManager(central: FakeCentralManager())
        manager.handleCentralStateUpdate(.unsupported)
        XCTAssertEqual(manager.connectionStatus, .error)
        XCTAssertEqual(manager.errorMessage, PlaySenseBLEErrorMessage.bluetoothUnsupported)
    }

    func testResettingAndUnknownAreTransientNotErrors() {
        let manager = makeManager(central: FakeCentralManager())
        manager.handleCentralStateUpdate(.resetting)
        XCTAssertNotEqual(manager.connectionStatus, .error)
        manager.handleCentralStateUpdate(.unknown)
        XCTAssertNotEqual(manager.connectionStatus, .error)
    }

    func testScanDeferredUntilPoweredOnThenResumes() {
        let central = FakeCentralManager()
        central.state = .unknown
        let manager = makeManager(central: central)

        manager.startScanning()
        XCTAssertEqual(central.scanCalls, 0, "must not scan before poweredOn")
        XCTAssertNotEqual(manager.connectionStatus, .error, "unknown is transient, not a reported failure")

        central.state = .poweredOn
        manager.handleCentralStateUpdate(.poweredOn)
        XCTAssertEqual(central.scanCalls, 1, "deferred scan resumes once poweredOn arrives")
        XCTAssertEqual(manager.connectionStatus, .scanning)
    }

    // MARK: - Scan → discover → connect → subscribed happy path

    func testFullConnectChainReachesConnectedAndPersistsIdentifier() {
        let central = FakeCentralManager()
        let manager = makeManager(central: central)
        let peripheral = FakePeripheral(name: "PlaySense")

        manager.startScanning()
        manager.handleDiscovered(peripheral: peripheral, advertisementData: [:])
        XCTAssertEqual(manager.discoveredDevices.map(\.id), [peripheral.identifier])

        manager.connect(to: manager.discoveredDevices[0])
        XCTAssertEqual(manager.connectionStatus, .connecting)
        XCTAssertEqual(central.connectedIdentifiers, [peripheral.identifier])
        XCTAssertEqual(central.stopScanCalls, 1, "connecting stops any in-flight scan")

        manager.handleConnected(peripheral: peripheral)
        XCTAssertEqual(peripheral.discoverServicesCalls.last ?? nil, [PlaySenseBLEProtocol.serviceUUID])

        manager.handleDiscoveredServiceUUIDs([PlaySenseBLEProtocol.serviceUUID], peripheral: peripheral)
        XCTAssertEqual(peripheral.discoverCharacteristicsCalls.last?.uuid, PlaySenseBLEProtocol.characteristicUUID)
        XCTAssertEqual(peripheral.discoverCharacteristicsCalls.last?.service, PlaySenseBLEProtocol.serviceUUID)

        manager.handleDiscoveredCharacteristicUUIDs([PlaySenseBLEProtocol.characteristicUUID], peripheral: peripheral)
        XCTAssertEqual(peripheral.setNotifyCalls.last?.enabled, true)
        XCTAssertEqual(peripheral.setNotifyCalls.last?.uuid, PlaySenseBLEProtocol.characteristicUUID)

        manager.handleNotificationStateUpdate(isNotifying: true, peripheral: peripheral)
        XCTAssertEqual(manager.connectionStatus, .connected)
        XCTAssertEqual(
            defaults.string(forKey: PlaySenseDeviceManager.persistedIdentifierKey),
            peripheral.identifier.uuidString
        )
    }

    func testNonMatchingPeripheralIsFilteredOut() {
        let manager = makeManager(central: FakeCentralManager())
        manager.startScanning()
        manager.handleDiscovered(
            peripheral: FakePeripheral(name: "SomeOtherThing"), advertisementData: [:]
        )
        XCTAssertTrue(manager.discoveredDevices.isEmpty)
    }

    func testDuplicateDiscoveryOfSamePeripheralIsNotAddedTwice() {
        let manager = makeManager(central: FakeCentralManager())
        let peripheral = FakePeripheral(name: "PlaySense")
        manager.startScanning()
        manager.handleDiscovered(peripheral: peripheral, advertisementData: [:])
        manager.handleDiscovered(peripheral: peripheral, advertisementData: [:])
        XCTAssertEqual(manager.discoveredDevices.count, 1)
    }

    func testServiceNotFoundFailsFreshConnectionWithFallbackMessage() {
        let central = FakeCentralManager()
        let manager = makeManager(central: central)
        let peripheral = FakePeripheral(name: "PlaySense")

        manager.startScanning()
        manager.handleDiscovered(peripheral: peripheral, advertisementData: [:])
        manager.connect(to: manager.discoveredDevices[0])
        manager.handleDiscoveredServiceUUIDs([], peripheral: peripheral) // target service absent

        XCTAssertEqual(manager.connectionStatus, .error)
        XCTAssertEqual(manager.errorMessage, PlaySenseBLEErrorMessage.connectFailedFallback)
    }

    // MARK: - Auto-select

    func testAutoSelectableDeviceRequiresExactlyOneMatch() {
        let device = PlaySenseDeviceManager.DiscoveredDevice(id: UUID(), name: "PlaySense")
        XCTAssertNil(PlaySenseDeviceManager.autoSelectableDevice(among: []))
        XCTAssertEqual(PlaySenseDeviceManager.autoSelectableDevice(among: [device]), device)
        XCTAssertNil(PlaySenseDeviceManager.autoSelectableDevice(among: [device, device]))
    }

    // MARK: - Persisted-identifier fast path

    func testPersistedIdentifierSkipsScanningAndConnectsDirectly() {
        let central = FakeCentralManager()
        let peripheral = FakePeripheral(name: "PlaySense")
        central.retrievableByIdentifier[peripheral.identifier] = peripheral
        defaults.set(peripheral.identifier.uuidString, forKey: PlaySenseDeviceManager.persistedIdentifierKey)
        let manager = makeManager(central: central)

        manager.connectUsingPersistedIdentifierOrScan()

        XCTAssertEqual(central.scanCalls, 0, "the fast path never scans")
        XCTAssertEqual(central.connectedIdentifiers, [peripheral.identifier])
        XCTAssertEqual(manager.connectionStatus, .connecting)
    }

    func testNoPersistedIdentifierFallsBackToScanning() {
        let central = FakeCentralManager()
        let manager = makeManager(central: central)

        manager.connectUsingPersistedIdentifierOrScan()

        XCTAssertEqual(central.scanCalls, 1)
        XCTAssertEqual(manager.connectionStatus, .scanning)
    }

    func testUnretrievablePersistedIdentifierFallsBackToScanning() {
        let central = FakeCentralManager()
        defaults.set(UUID().uuidString, forKey: PlaySenseDeviceManager.persistedIdentifierKey)
        let manager = makeManager(central: central)

        manager.connectUsingPersistedIdentifierOrScan() // central has nothing retrievable for this id

        XCTAssertEqual(central.scanCalls, 1)
    }

    // MARK: - Reconnect-once-then-fail semantics

    private func connectToConnectedState(
        central: FakeCentralManager, peripheral: FakePeripheral
    ) -> PlaySenseDeviceManager {
        let manager = makeManager(central: central)
        manager.startScanning()
        manager.handleDiscovered(peripheral: peripheral, advertisementData: [:])
        manager.connect(to: manager.discoveredDevices[0])
        manager.handleConnected(peripheral: peripheral)
        manager.handleDiscoveredServiceUUIDs([PlaySenseBLEProtocol.serviceUUID], peripheral: peripheral)
        manager.handleDiscoveredCharacteristicUUIDs([PlaySenseBLEProtocol.characteristicUUID], peripheral: peripheral)
        manager.handleNotificationStateUpdate(isNotifying: true, peripheral: peripheral)
        precondition(manager.connectionStatus == .connected)
        return manager
    }

    func testUnexpectedDisconnectWhileWantingConnectionAttemptsOneReconnect() {
        let central = FakeCentralManager()
        let peripheral = FakePeripheral(name: "PlaySense")
        let manager = connectToConnectedState(central: central, peripheral: peripheral)
        manager.wantsConnection = true

        manager.handleDisconnected(peripheral: peripheral)

        XCTAssertEqual(manager.connectionStatus, .reconnecting)
        XCTAssertEqual(central.connectedIdentifiers.count, 2, "original connect + one reconnect attempt")
    }

    func testSecondDisconnectAfterReconnectAttemptGivesUpWithVerbatimWebMessage() {
        let central = FakeCentralManager()
        let peripheral = FakePeripheral(name: "PlaySense")
        let manager = connectToConnectedState(central: central, peripheral: peripheral)
        manager.wantsConnection = true

        manager.handleDisconnected(peripheral: peripheral) // → .reconnecting
        manager.handleDisconnected(peripheral: peripheral) // the reconnect attempt itself failed

        XCTAssertEqual(manager.connectionStatus, .error)
        XCTAssertEqual(manager.errorMessage, PlaySenseBLEErrorMessage.reconnectFailed)
        XCTAssertEqual(central.connectedIdentifiers.count, 2, "never attempts a third connect")
    }

    func testFailToConnectDuringReconnectAttemptReportsReconnectFailed() {
        let central = FakeCentralManager()
        let peripheral = FakePeripheral(name: "PlaySense")
        let manager = connectToConnectedState(central: central, peripheral: peripheral)
        manager.wantsConnection = true

        manager.handleDisconnected(peripheral: peripheral) // → .reconnecting
        manager.handleFailedToConnect(peripheral: peripheral, error: nil)

        XCTAssertEqual(manager.connectionStatus, .error)
        XCTAssertEqual(manager.errorMessage, PlaySenseBLEErrorMessage.reconnectFailed)
    }

    func testDisconnectWithoutWantingConnectionGoesStraightToDisconnected() {
        let central = FakeCentralManager()
        let peripheral = FakePeripheral(name: "PlaySense")
        let manager = connectToConnectedState(central: central, peripheral: peripheral)
        manager.wantsConnection = false

        manager.handleDisconnected(peripheral: peripheral)

        XCTAssertEqual(manager.connectionStatus, .disconnected)
        XCTAssertEqual(central.connectedIdentifiers.count, 1, "no reconnect attempt when not wanted")
    }

    func testFreshFailedConnectReportsUnderlyingErrorNotReconnectMessage() {
        let central = FakeCentralManager()
        let manager = makeManager(central: central)
        let peripheral = FakePeripheral(name: "PlaySense")
        manager.startScanning()
        manager.handleDiscovered(peripheral: peripheral, advertisementData: [:])
        manager.connect(to: manager.discoveredDevices[0])

        manager.handleFailedToConnect(peripheral: peripheral, error: nil)

        XCTAssertEqual(manager.connectionStatus, .error)
        XCTAssertEqual(manager.errorMessage, PlaySenseBLEErrorMessage.connectFailedFallback)
    }

    // MARK: - Notification decode end-to-end

    func testCharacteristicValueUpdateDecodesAndForwardsReading() {
        let manager = makeManager(central: FakeCentralManager())
        var received: PlaySenseBLEReading?
        manager.onReading = { received = $0 }

        let json = #"{"piezos":[0,900,0]}"#
        manager.handleCharacteristicValueUpdate(uuid: PlaySenseBLEProtocol.characteristicUUID, data: Data(json.utf8))

        XCTAssertEqual(received?.piezos, [0, 900, 0])
    }

    func testCharacteristicValueUpdateIgnoresWrongCharacteristicUUID() {
        let manager = makeManager(central: FakeCentralManager())
        var received: PlaySenseBLEReading?
        manager.onReading = { received = $0 }

        let json = #"{"piezos":[0,900,0]}"#
        manager.handleCharacteristicValueUpdate(uuid: CBUUID(string: "FFFF"), data: Data(json.utf8))

        XCTAssertNil(received)
    }

    // MARK: - disconnect()

    func testDisconnectClearsStateAndCancelsTheLivePeripheral() {
        let central = FakeCentralManager()
        let peripheral = FakePeripheral(name: "PlaySense")
        let manager = connectToConnectedState(central: central, peripheral: peripheral)

        manager.disconnect()

        XCTAssertEqual(manager.connectionStatus, .disconnected)
        XCTAssertEqual(central.cancelConnectionIdentifiers, [peripheral.identifier])
        XCTAssertFalse(manager.wantsConnection)
        XCTAssertTrue(manager.discoveredDevices.isEmpty)
    }

    // MARK: - NoOpBLECentralManager (DEBUG demo seam)

    /// Regression coverage for a real bug found while capturing D25's screenshot evidence: a manager
    /// constructed with a REAL `CBCentralManager` (the default) reports its state asynchronously as soon
    /// as it exists — regardless of whether scanning ever starts — which raced with and silently reverted
    /// a `SessionCoordinator` DEBUG synthetic/forced state a beat later (the Simulator's real Bluetooth
    /// state is typically `.unsupported`/`.unauthorized`, read as a connection failure). A manager built
    /// with `NoOpBLECentralManager` must never receive ANY such callback, at any point — it starts
    /// `.poweredOn` and stays there because nothing ever drives `handleCentralStateUpdate` for it.
    func testNoOpCentralManagerNeverChangesConnectionStatus() {
        let manager = PlaySenseDeviceManager(central: NoOpBLECentralManager(), defaults: defaults)
        manager.debugInjectDiscoveredDevices([.init(id: UUID(), name: "PlaySense")])
        XCTAssertEqual(manager.connectionStatus, .scanning, "forced by debugInjectDiscoveredDevices itself")
        XCTAssertEqual(manager.discoveredDevices.count, 1, "the forced state must not have been overwritten")
    }
}
