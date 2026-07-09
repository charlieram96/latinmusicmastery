import CoreBluetooth
import PlaySenseCore
import XCTest

@testable import PlaySenseBLE

/// Fix round 1 for D25's review, finding 3: "infinite scan with no escape" — `PlaySenseDeviceManager`'s
/// scan now times out (~15s, via an injected `DeferredScheduler` here so nothing waits on a real timer) and
/// surfaces a typed `PlaySenseBLEErrorMessage.noDeviceFound` error, cancelled at every real exit from
/// `.scanning`. Split into its own file (same `FakeCentralManager`/`FakePeripheral` fakes as
/// `PlaySenseDeviceManagerTests`, just a separate `XCTestCase`) purely to keep that file under SwiftLint's
/// `file_length`/`type_body_length` caps — no behavioral significance.
@MainActor
final class PlaySenseDeviceManagerScanTimeoutTests: XCTestCase {

    private var defaults: UserDefaults!

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: "PlaySenseDeviceManagerScanTimeoutTests")
        defaults.removePersistentDomain(forName: "PlaySenseDeviceManagerScanTimeoutTests")
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: "PlaySenseDeviceManagerScanTimeoutTests")
        defaults = nil
        super.tearDown()
    }

    private func makeManager(central: FakeCentralManager, scheduler: DeferredScheduler) -> PlaySenseDeviceManager {
        PlaySenseDeviceManager(central: central, defaults: defaults, scheduler: scheduler)
    }

    func testScanTimeoutFiresTypedNoDeviceFoundErrorAndStopsTheScan() {
        let central = FakeCentralManager()
        let scheduler = ManualDeferredScheduler()
        let manager = makeManager(central: central, scheduler: scheduler)

        manager.startScanning()
        XCTAssertEqual(manager.connectionStatus, .scanning)

        scheduler.advance(byMilliseconds: 15_000)

        XCTAssertEqual(manager.connectionStatus, .error)
        XCTAssertEqual(manager.errorMessage, PlaySenseBLEErrorMessage.noDeviceFound)
        XCTAssertEqual(central.stopScanCalls, 1, "the timeout stops the still-running scan")
    }

    func testScanTimeoutDoesNotFireEarly() {
        let central = FakeCentralManager()
        let scheduler = ManualDeferredScheduler()
        let manager = makeManager(central: central, scheduler: scheduler)

        manager.startScanning()
        scheduler.advance(byMilliseconds: 14_999)

        XCTAssertEqual(manager.connectionStatus, .scanning, "must not time out a moment early")
    }

    func testDiscoveringADeviceCancelsTheScanTimeout() {
        let central = FakeCentralManager()
        let scheduler = ManualDeferredScheduler()
        let manager = makeManager(central: central, scheduler: scheduler)
        let peripheral = FakePeripheral(name: "PlaySense")

        manager.startScanning()
        manager.handleDiscovered(peripheral: peripheral, advertisementData: [:])
        scheduler.advance(byMilliseconds: 15_000)

        XCTAssertEqual(manager.connectionStatus, .scanning, "a match was found — no longer 'device not found'")
        XCTAssertNotEqual(manager.errorMessage, PlaySenseBLEErrorMessage.noDeviceFound)
    }

    func testConnectingCancelsTheScanTimeout() {
        let central = FakeCentralManager()
        let scheduler = ManualDeferredScheduler()
        let manager = makeManager(central: central, scheduler: scheduler)
        let peripheral = FakePeripheral(name: "PlaySense")

        manager.startScanning()
        manager.handleDiscovered(peripheral: peripheral, advertisementData: [:])
        manager.connect(to: manager.discoveredDevices[0])
        scheduler.advance(byMilliseconds: 15_000)

        XCTAssertEqual(manager.connectionStatus, .connecting, "the timeout must not clobber an in-flight connect")
    }

    func testStopScanningCancelsTheScanTimeout() {
        let central = FakeCentralManager()
        let scheduler = ManualDeferredScheduler()
        let manager = makeManager(central: central, scheduler: scheduler)

        manager.startScanning()
        manager.stopScanning()
        scheduler.advance(byMilliseconds: 15_000)

        XCTAssertEqual(manager.connectionStatus, .disconnected, "an explicit stop must not later flip to .error")
    }

    func testDisconnectCancelsTheScanTimeout() {
        let central = FakeCentralManager()
        let scheduler = ManualDeferredScheduler()
        let manager = makeManager(central: central, scheduler: scheduler)

        manager.startScanning()
        manager.disconnect()
        scheduler.advance(byMilliseconds: 15_000)

        XCTAssertEqual(manager.connectionStatus, .disconnected, "an explicit disconnect must not later flip to .error")
    }

    /// D27 ledger cleanup: a manager deallocating mid-scan (no explicit `disconnect()`/`stopScanning()`
    /// call first — e.g. `SessionCoordinator` simply dropping its reference) used to leave the scan
    /// timeout scheduled with nothing to cancel it. `deinit` now cancels it like every other real exit
    /// from `.scanning`, closing the latent (if harmless, since the handle's own closure captures `self`
    /// weakly) trap.
    func testDeinitCancelsTheScanTimeout() {
        let central = FakeCentralManager()
        let scheduler = ManualDeferredScheduler()
        var manager: PlaySenseDeviceManager? = makeManager(central: central, scheduler: scheduler)

        manager?.startScanning()
        XCTAssertEqual(scheduler.pendingCount, 1, "the scan timeout should be scheduled")

        manager = nil

        XCTAssertEqual(scheduler.pendingCount, 0, "deinit must cancel the pending scan timeout")
    }
}
