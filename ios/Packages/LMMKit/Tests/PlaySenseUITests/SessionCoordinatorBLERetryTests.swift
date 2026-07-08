import CoreBluetooth
import PlaySenseCore
import XCTest

@testable import PlaySenseBLE
@testable import PlaySenseUI

/// Coordinator-level coverage for fix round 1 (D25's review): finding 1 ("retry() never restores a dropped
/// BLE connection"), finding 2 ("BLE connect-failure error never shown"), and finding 3's coordinator-facing
/// half (scan timeout + Cancel button) — the device-manager-internal half of finding 3 (the timeout/cancel
/// mechanics themselves) is covered directly in `PlaySenseBLETests/PlaySenseDeviceManagerTests.swift`.
///
/// Uses a `PlaySenseBLECentralManaging` fake injected via `SessionCoordinator.debugBLECentral` — the same
/// fakes-only technique `PlaySenseDeviceManagerTests` uses, generalized to the coordinator via
/// `bleManager`/`machine` being `internal` (not `private`) specifically for this. Active-take setup
/// (`.playing`, `.interrupted`) is driven directly through the pure `SessionPhaseMachine` rather than a real
/// `startSession()`/`GameAudioEngine` take — `SessionEndToEndSmokeTests` shows that path is unavoidably
/// environment-sensitive (mic permission, real audio hardware), which would make these tests flaky/slow for
/// no benefit: nothing under test here touches audio at all.
@MainActor
final class SessionCoordinatorBLERetryTests: XCTestCase {

    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "SessionCoordinatorBLERetryTests")
        defaults.removePersistentDomain(forName: "SessionCoordinatorBLERetryTests")
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: "SessionCoordinatorBLERetryTests")
        defaults = nil
        super.tearDown()
    }

    // MARK: - Helpers

    private func makeCoordinator(central: FakeBLECentral, scheduler: DeferredScheduler? = nil) -> SessionCoordinator {
        let coordinator = SessionCoordinator()
        coordinator.debugBLECentral = central
        coordinator.debugBLEDefaults = defaults
        if let scheduler { coordinator.debugBLEScheduler = scheduler }
        coordinator.present(exercise: StagePlayerView.sampleExercise)
        return coordinator
    }

    /// Selects `.playsense`, discovers ONE matching peripheral (auto-connects with no picker needed), and
    /// marches the manager through the rest of the real connect chain to `.connected` — the same sequence
    /// `PlaySenseDeviceManagerTests.testFullConnectChainReachesConnectedAndPersistsIdentifier` uses, just
    /// reached through `coordinator.bleManager` instead of a standalone manager.
    @discardableResult
    private func connectBLE(_ coordinator: SessionCoordinator, peripheral: FakeBLEPeripheral) -> SessionCoordinator {
        coordinator.selectMode(.playsense)
        coordinator.bleManager?.handleDiscovered(peripheral: peripheral, advertisementData: [:])
        coordinator.bleManager?.handleConnected(peripheral: peripheral)
        coordinator.bleManager?.handleDiscoveredServiceUUIDs([PlaySenseBLEProtocol.serviceUUID], peripheral: peripheral)
        coordinator.bleManager?.handleDiscoveredCharacteristicUUIDs(
            [PlaySenseBLEProtocol.characteristicUUID], peripheral: peripheral
        )
        coordinator.bleManager?.handleNotificationStateUpdate(isNotifying: true, peripheral: peripheral)
        precondition(coordinator.bleConnectionStatus == .connected, "test setup: expected BLE to reach .connected")
        return coordinator
    }

    // MARK: - Finding 1: retry() must restore a dropped BLE connection

    func testRetryAfterExhaustedReconnectRoutesThroughConnectingDeviceAndReconnects() {
        let central = FakeBLECentral()
        let peripheral = FakeBLEPeripheral(name: "PlaySense")
        let coordinator = connectBLE(makeCoordinator(central: central), peripheral: peripheral)
        XCTAssertEqual(coordinator.phase, .ready)

        // Drive an active take → the exhausted-BLE-reconnect interruption, purely through the pure phase
        // machine (see this file's module doc for why).
        coordinator.machine.requestStart(isBluetoothOutput: false)
        coordinator.machine.beginPlaying()
        coordinator.machine.interrupt(.bleDisconnected)
        XCTAssertEqual(coordinator.phase, .interrupted(.bleDisconnected))

        // The manager itself actually dropping and exhausting its one reconnect attempt (mirrors what
        // would, on a real device, have produced that `.bleDisconnected` interruption in the first place).
        coordinator.bleManager?.wantsConnection = true
        coordinator.bleManager?.handleDisconnected(peripheral: peripheral) // → .reconnecting
        coordinator.bleManager?.handleDisconnected(peripheral: peripheral) // reconnect attempt itself failed
        XCTAssertNotEqual(coordinator.bleConnectionStatus, .connected)

        let scansBefore = central.scanCalls
        let connectsBefore = central.connectedIdentifiers.count

        coordinator.retry()

        XCTAssertEqual(coordinator.phase, .connectingDevice, "must detour through a reconnect, not straight to .ready")
        XCTAssertTrue(
            central.scanCalls > scansBefore || central.connectedIdentifiers.count > connectsBefore,
            "the manager must have been asked to reconnect (a fresh scan or a persisted-identifier connect)"
        )
    }

    func testRetryWhileStillConnectedSkipsStraightToReadyWithNoSpuriousReconnect() {
        let central = FakeBLECentral()
        let peripheral = FakeBLEPeripheral(name: "PlaySense")
        let coordinator = connectBLE(makeCoordinator(central: central), peripheral: peripheral)

        coordinator.machine.requestStart(isBluetoothOutput: false)
        coordinator.machine.beginPlaying()
        coordinator.machine.interrupt(.audioInterruption) // unrelated disruption — BLE itself stays connected
        XCTAssertEqual(coordinator.bleConnectionStatus, .connected)

        let scansBefore = central.scanCalls
        let connectsBefore = central.connectedIdentifiers.count

        coordinator.retry()

        XCTAssertEqual(coordinator.phase, .ready, "still connected — retry skips straight to ready")
        XCTAssertEqual(central.scanCalls, scansBefore, "no spurious reconnect while already connected")
        XCTAssertEqual(
            central.connectedIdentifiers.count, connectsBefore, "no spurious reconnect while already connected"
        )
    }

    func testMicModeRetryIsUnaffectedByTheBLEReconnectCheck() {
        // Regression guard: `needsBLEReconnectBeforeProceeding` must be `false` for non-`.playsense` modes
        // regardless of `bleConnectionStatus` (always `.disconnected` here — no BLE ever selected).
        let coordinator = SessionCoordinator()
        coordinator.present(exercise: StagePlayerView.sampleExercise)
        coordinator.selectMode(.headphones)
        coordinator.calibrationResolved()
        coordinator.machine.requestStart(isBluetoothOutput: false)
        coordinator.machine.beginPlaying()
        coordinator.machine.interrupt(.audioInterruption)

        coordinator.retry()

        XCTAssertEqual(coordinator.phase, .ready)
    }

    // MARK: - Finding 2: BLE connect-failure error must survive the transition to `.modeSelect`

    func testConnectFailureErrorSurvivesTransitionToModeSelect() {
        let central = FakeBLECentral()
        central.state = .unsupported // a real Simulator's typical unusable state (see the manager's module doc)
        let coordinator = makeCoordinator(central: central)

        coordinator.selectMode(.playsense)

        XCTAssertEqual(coordinator.phase, .modeSelect, "a failed connect bounces back to mode select")
        XCTAssertEqual(coordinator.errorMessage, PlaySenseBLEErrorMessage.bluetoothUnsupported)
    }

    func testSelectingAModeClearsAPreviousConnectFailureError() {
        let central = FakeBLECentral()
        central.state = .unsupported
        let coordinator = makeCoordinator(central: central)
        coordinator.selectMode(.playsense)
        XCTAssertNotNil(coordinator.errorMessage)

        coordinator.selectMode(.headphones)

        XCTAssertNil(coordinator.errorMessage, "a fresh mode choice must not still show the last attempt's error")
    }

    // MARK: - Finding 3: scan timeout + Cancel (coordinator-facing half)

    func testScanTimeoutSurfacesErrorAndReturnsToModeSelect() {
        let central = FakeBLECentral()
        let scheduler = ManualDeferredScheduler()
        let coordinator = makeCoordinator(central: central, scheduler: scheduler)

        coordinator.selectMode(.playsense)
        XCTAssertEqual(coordinator.phase, .connectingDevice)

        scheduler.advance(byMilliseconds: 15_000)

        XCTAssertEqual(coordinator.phase, .modeSelect)
        XCTAssertEqual(coordinator.errorMessage, PlaySenseBLEErrorMessage.noDeviceFound)
    }

    func testCancelBLEConnectStopsTheScanAndReturnsToModeSelectWithNoError() {
        let central = FakeBLECentral()
        let coordinator = makeCoordinator(central: central)

        coordinator.selectMode(.playsense)
        XCTAssertEqual(coordinator.phase, .connectingDevice)
        let stopScanCallsWhileScanning = central.stopScanCalls

        coordinator.cancelBLEConnect()

        XCTAssertEqual(coordinator.phase, .modeSelect)
        XCTAssertNil(coordinator.errorMessage, "a deliberate cancel is not a reported failure")
        XCTAssertGreaterThan(central.stopScanCalls, stopScanCallsWhileScanning, "cancel stops the in-flight scan")
    }
}

// MARK: - Fakes (public-protocol conformances; @testable only needed for PlaySenseDeviceManager's internal
// handle* methods and SessionCoordinator's internal bleManager/machine used above, not for these themselves)

@MainActor
private final class FakeBLECentral: PlaySenseBLECentralManaging {
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

@MainActor
private final class FakeBLEPeripheral: PlaySenseBLEPeripheral {
    let identifier: UUID
    var name: String?

    init(identifier: UUID = UUID(), name: String? = "PlaySense") {
        self.identifier = identifier
        self.name = name
    }

    func setDelegate(_ delegate: CBPeripheralDelegate) {}
    func discoverServices(_ serviceUUIDs: [CBUUID]?) {}
    func discoverCharacteristics(uuid: CBUUID, inServiceWithUUID serviceUUID: CBUUID) {}
    func setNotify(_ enabled: Bool, forCharacteristicUUID uuid: CBUUID, inServiceWithUUID serviceUUID: CBUUID) {}
}
