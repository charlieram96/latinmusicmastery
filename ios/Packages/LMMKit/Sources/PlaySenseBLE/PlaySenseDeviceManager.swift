import CoreBluetooth
import Foundation
import Observation
import PlaySenseCore

/// CoreBluetooth lifecycle for the PlaySense hardware device — port of `playsense-context.tsx`'s
/// `PlaysenseProvider` (scan/connect/subscribe/reconnect state machine) onto `CBCentralManager`.
///
/// ## Untested-glue inventory (D25 plan: "keep the real delegate code THIN so untested glue is minimal")
/// Everything that makes a DECISION (which peripheral counts as a match, when to retry, what status/error
/// to publish, how to decode a notification) lives in `internal` `handle*` methods below, exercised in
/// `PlaySenseDeviceManagerTests` via `PlaySenseBLECentralManaging`/`PlaySenseBLEPeripheral` fakes — no real
/// CoreBluetooth object involved. The only code that touches REAL `CBCentralManager`/`CBPeripheral` APIs
/// and is NOT unit-tested is:
/// 1. The `CBCentralManagerDelegate`/`CBPeripheralDelegate` conformances (fix round 1: moved to
///    `PlaySenseDeviceManager+CoreBluetoothDelegate.swift` to stay under `file_length` — no behavioral
///    change) — each is a one-line extract-and-forward into a `handle*` method. A few extract the
///    forwarded value with a ternary/`&&` keyed on `error == nil` (e.g. `didDiscoverServices`'s
///    `error == nil ? ... : []`) — that's shaping the SAME callback's own payload before forwarding it,
///    not a DECISION about what to do next (the `handle*` method it forwards into makes that decision,
///    and IS unit-tested); no conformance here branches into different coordinator/manager behavior on
///    its own.
/// 2. The five adapter methods in `PlaySenseBLEShims.swift` (`connect`/`cancelConnection`/
///    `retrieveKnownPeripheral`/`discoverCharacteristics(uuid:inServiceWithUUID:)`/
///    `setNotify(_:forCharacteristicUUID:inServiceWithUUID:)`) — each is a 1-2 line downcast-or-lookup,
///    no branching beyond a guard.
/// Both are inherent to CoreBluetooth (real hardware, and `CBService`/`CBCharacteristic` have no public
/// initializer to fake) — see D25's report for why this is the practical floor, not a shortcut.
///
/// ## Simulator
/// CoreBluetooth has no radio on the Simulator: `CBCentralManager`'s state on most Simulator/host
/// combinations never leaves `.unknown`/`.unsupported`, so scanning never discovers a real peripheral.
/// `SessionCoordinator`'s `debugSyntheticBLESession` DEBUG seam bypasses this manager entirely for
/// end-to-end session testing; real-hardware verification is D27's device pass.
@MainActor
@Observable
public final class PlaySenseDeviceManager: NSObject {

    /// A PlaySense peripheral discovered during a scan — the identity `DevicePickerSheet` lists and
    /// `connect(to:)` accepts.
    public struct DiscoveredDevice: Identifiable, Equatable, Sendable {
        public let id: UUID
        public let name: String

        public init(id: UUID, name: String) {
            self.id = id
            self.name = name
        }
    }

    public private(set) var connectionStatus: BLEConnectionStatus = .disconnected
    public private(set) var errorMessage: String?
    public private(set) var discoveredDevices: [DiscoveredDevice] = []

    /// Port of the web's `wantConnectedRef` — true while the app wants to stay connected (a session is
    /// selecting/using PlaySense mode); gates the one-shot auto-reconnect on an unexpected disconnect.
    /// Public and directly settable (not `private(set)`) because `SessionCoordinator` toggles it around a
    /// play session's lifetime, mirroring the web's plain ref assignment.
    public var wantsConnection = false

    /// Fires for every successfully decoded notification. Set BEFORE starting a take — mirrors
    /// `OnsetEventSource.onOnset`'s "set before start()" contract.
    public var onReading: ((PlaySenseBLEReading) -> Void)?
    /// Push notification for `connectionStatus` changes, for callers that need to react imperatively
    /// (`SessionCoordinator`'s phase-machine transitions) rather than only via `@Observable` UI tracking.
    public var onConnectionStatusChange: ((BLEConnectionStatus) -> Void)?
    /// Push notification for `discoveredDevices` changes — lets `SessionCoordinator` auto-select a single
    /// match without polling.
    public var onDiscoveredDevicesChange: (([DiscoveredDevice]) -> Void)?

    private var central: (any PlaySenseBLECentralManaging)!
    private var connectedPeripheral: (any PlaySenseBLEPeripheral)?
    private var pendingPeripherals: [UUID: any PlaySenseBLEPeripheral] = [:]
    private var reconnectAttempts = 0
    private var scanRequestedWhenPoweredOn = false
    private let defaults: UserDefaults
    private let scheduler: DeferredScheduler
    /// Fix round 1 (D25's review, finding 3): the in-flight scan-timeout, if any — cancelled at every real
    /// exit from `.scanning` (`beginConnecting`, `stopScanning`, `disconnect`) so a stale timeout never
    /// fires after the scan has already resolved one way or another.
    private var scanTimeoutHandle: DeferredHandle?
    /// No product spec pins an exact value; 15s is long enough for a real scan/advertise cycle to complete
    /// but short enough that "nothing found" doesn't read as a hang — matches this module's other web-parity
    /// error strings in spirit (a typed, bounded failure) even though the web has no scan phase of its own
    /// to time out (`navigator.bluetooth.requestDevice()`'s browser-native picker has its own UI for "no
    /// device found", entirely outside app code).
    private static let scanTimeoutMilliseconds: Double = 15_000

    /// `internal` (not `private`) specifically so `@testable`-imported tests can assert against the exact
    /// key without duplicating the literal — same rationale as `CalibrationStore.storageKey(...)`.
    static let persistedIdentifierKey = "com.lmm.playsense.ble.lastPeripheralIdentifier"

    /// - Parameter central: injected for tests (a `PlaySenseBLECentralManaging` fake); `nil` (the default)
    ///   constructs a real `CBCentralManager` with this instance as its delegate, callbacks on the main
    ///   queue (`queue: nil`) — which is what makes the `MainActor.assumeIsolated` calls in the delegate
    ///   conformances below safe (see their doc comments).
    /// - Parameter scheduler: fix round 1 seam for the scan-timeout above — production wires the default
    ///   real `RealDeferredScheduler()`; `PlaySenseDeviceManagerTests` wires a `ManualDeferredScheduler` to
    ///   advance the timeout deterministically instead of waiting on a real ~15s timer.
    public init(
        central: (any PlaySenseBLECentralManaging)? = nil,
        defaults: UserDefaults = .standard,
        scheduler: DeferredScheduler = RealDeferredScheduler()
    ) {
        self.defaults = defaults
        self.scheduler = scheduler
        super.init()
        self.central = central ?? CBCentralManager(delegate: self, queue: nil)
    }

    // MARK: - Public flow

    /// Try the persisted-identifier fast path (skip scanning if the OS still knows the last connected
    /// peripheral), else fall back to a fresh scan. The entry point `SessionCoordinator` calls when the
    /// user selects PlaySense mode.
    public func connectUsingPersistedIdentifierOrScan() {
        errorMessage = nil
        if central.state == .poweredOn,
           let idString = defaults.string(forKey: Self.persistedIdentifierKey),
           let id = UUID(uuidString: idString),
           let peripheral = central.retrieveKnownPeripheral(withIdentifier: id) {
            beginConnecting(to: peripheral)
            return
        }
        startScanning()
    }

    /// Scan for PlaySense peripherals: unfiltered at the CoreBluetooth level (no `services:` filter),
    /// because "the firmware may not advertise the service" (plan) — every discovered peripheral is
    /// checked locally against `PlaySenseBLEProtocol.matches(name:advertisementData:)` (name OR
    /// advertised service UUID), so a device that only advertises by name is still found.
    public func startScanning() {
        errorMessage = nil
        setDiscoveredDevices([])
        pendingPeripherals.removeAll()
        scanTimeoutHandle?.cancel()
        guard central.state == .poweredOn else {
            scanRequestedWhenPoweredOn = true
            handleCentralStateUpdate(central.state) // surfaces an immediate error for a terminal state
            return
        }
        scanRequestedWhenPoweredOn = false
        setStatus(.scanning)
        central.scanForPeripherals(withServices: nil, options: nil)
        // Fix round 1 (D25's review, finding 3): a scan that never finds anything used to hang forever —
        // stop it and surface a typed "no device found" error after a bounded wait.
        scanTimeoutHandle = scheduler.schedule(afterMilliseconds: Self.scanTimeoutMilliseconds) { [weak self] in
            self?.handleScanTimeout()
        }
    }

    public func stopScanning() {
        scanRequestedWhenPoweredOn = false
        scanTimeoutHandle?.cancel()
        central.stopScan()
        if connectionStatus == .scanning { setStatus(.disconnected) }
    }

    /// Connect to a device the caller chose from `discoveredDevices` (`DevicePickerSheet`) or that
    /// auto-selected (`autoSelectableDevice(among:)`).
    public func connect(to device: DiscoveredDevice) {
        guard let peripheral = pendingPeripherals[device.id] else { return }
        beginConnecting(to: peripheral)
    }

    /// Tear down entirely: no further reconnect attempts, forget the live peripheral. Port of the web's
    /// `disconnect()`. Does NOT clear the persisted identifier — the NEXT `connectUsingPersistedIdentifierOrScan()`
    /// still fast-paths back to the same device.
    public func disconnect() {
        wantsConnection = false
        reconnectAttempts = 0
        scanTimeoutHandle?.cancel()
        central.stopScan()
        if let connectedPeripheral { central.cancelConnection(connectedPeripheral) }
        connectedPeripheral = nil
        onReading = nil
        setDiscoveredDevices([])
        setStatus(.disconnected)
    }

    /// Exactly one discovered device auto-connects with no picker shown; anything else (0 or 2+) is left
    /// for the caller (wait, or show `DevicePickerSheet`). Pure so the "auto-select" decision itself is
    /// unit-tested without any scanning involved.
    public static func autoSelectableDevice(among devices: [DiscoveredDevice]) -> DiscoveredDevice? {
        devices.count == 1 ? devices.first : nil
    }

    #if DEBUG
    /// Screenshot/testing seam: injects synthetic discovered devices directly, bypassing real scanning
    /// entirely — CoreBluetooth has no radio on the Simulator (see this type's module doc), so this is how
    /// `DevicePickerSheet`'s multiple-device path gets exercised/screenshotted there. Forces `.scanning`
    /// first regardless of whatever the Simulator's real `CBCentralManager` state produced, so the caller
    /// doesn't need real scanning to have reached a usable state at all.
    public func debugInjectDiscoveredDevices(_ devices: [DiscoveredDevice]) {
        setStatus(.scanning)
        setDiscoveredDevices(devices)
    }
    #endif

    private func beginConnecting(to peripheral: any PlaySenseBLEPeripheral) {
        scanTimeoutHandle?.cancel()
        central.stopScan()
        reconnectAttempts = 0
        connectedPeripheral = peripheral
        setStatus(.connecting)
        central.connect(peripheral)
    }

    // MARK: - Status/error/device-list plumbing

    private func setStatus(_ status: BLEConnectionStatus) {
        connectionStatus = status
        if status != .error { errorMessage = nil }
        onConnectionStatusChange?(status)
    }

    private func setError(_ message: String) {
        errorMessage = message
        connectionStatus = .error
        onConnectionStatusChange?(.error)
    }

    private func setDiscoveredDevices(_ devices: [DiscoveredDevice]) {
        discoveredDevices = devices
        onDiscoveredDevicesChange?(devices)
    }

    /// Whichever failure mode reported it — a fresh `connect()`, or the single reconnect attempt — routes
    /// through here so the "was this a retry?" branch lives in exactly one place. While `connectionStatus`
    /// is `.reconnecting`, ANY failure (fail-to-connect, service/characteristic missing, notify error)
    /// means the one reconnect attempt itself failed, so the message is the web's verbatim
    /// `reconnectFailed` string regardless of which step of the chain broke.
    private func failConnection(freshMessage: String) {
        if connectionStatus == .reconnecting {
            setError(PlaySenseBLEErrorMessage.reconnectFailed)
        } else {
            setError(freshMessage)
        }
    }

    private func persistIdentifier(_ id: UUID) {
        defaults.set(id.uuidString, forKey: Self.persistedIdentifierKey)
    }

    // MARK: - Testable handlers (driven by the real delegate glue at the bottom of this file, or directly
    // by PlaySenseDeviceManagerTests via a PlaySenseBLECentralManaging/PlaySenseBLEPeripheral fake)

    func handleCentralStateUpdate(_ state: CBManagerState) {
        if state == .poweredOn, scanRequestedWhenPoweredOn {
            startScanning()
            return
        }
        switch state {
        case .poweredOff: setError(PlaySenseBLEErrorMessage.bluetoothPoweredOff)
        case .unauthorized: setError(PlaySenseBLEErrorMessage.bluetoothUnauthorized)
        case .unsupported: setError(PlaySenseBLEErrorMessage.bluetoothUnsupported)
        case .poweredOn, .resetting, .unknown: break
        @unknown default: break
        }
    }

    /// Fix round 1 (D25's review, finding 3): fires ~`scanTimeoutMilliseconds` after `startScanning()` if
    /// nothing has connected/discovered-and-auto-connected by then. Guards `connectionStatus == .scanning`
    /// so a timeout scheduled just before the scan legitimately resolved (a connect began, the scan was
    /// stopped) is a harmless no-op rather than clobbering a later, unrelated state — belt-and-suspenders
    /// alongside the `scanTimeoutHandle?.cancel()` calls at every real exit from `.scanning`.
    func handleScanTimeout() {
        guard connectionStatus == .scanning else { return }
        central.stopScan()
        setError(PlaySenseBLEErrorMessage.noDeviceFound)
    }

    func handleDiscovered(peripheral: any PlaySenseBLEPeripheral, advertisementData: [String: Any]) {
        guard connectionStatus == .scanning else { return }
        guard PlaySenseBLEProtocol.matches(name: peripheral.name, advertisementData: advertisementData) else { return }
        guard pendingPeripherals[peripheral.identifier] == nil else { return } // already seen this scan
        pendingPeripherals[peripheral.identifier] = peripheral
        let name = peripheral.name ?? PlaySenseBLEProtocol.deviceName
        let device = DiscoveredDevice(id: peripheral.identifier, name: name)
        setDiscoveredDevices(discoveredDevices + [device])
        // A match was found — the scan timeout's "device not found" framing no longer applies, even if
        // this is the multi-device case and `DevicePickerSheet` is now waiting on a user choice rather than
        // on discovery. (The single-match auto-connect path also cancels it, redundantly but harmlessly, via
        // `beginConnecting`.)
        scanTimeoutHandle?.cancel()
    }

    func handleConnected(peripheral: any PlaySenseBLEPeripheral) {
        peripheral.setDelegate(self)
        peripheral.discoverServices([PlaySenseBLEProtocol.serviceUUID])
    }

    /// A FRESH `connect()`/first-attempt failure (CoreBluetooth's `didFailToConnect`, which — unlike
    /// `didDisconnectPeripheral` — also fires for the retry itself if IT can't establish a connection at
    /// all). `connectionStatus == .reconnecting` distinguishes the two: `beginReconnectAttempt` sets it
    /// synchronously right before calling `central.connect(peripheral)`, so a failure arriving while still
    /// in that state IS the reconnect attempt's outcome.
    func handleFailedToConnect(peripheral: any PlaySenseBLEPeripheral, error: Error?) {
        connectedPeripheral = nil
        failConnection(freshMessage: error?.localizedDescription ?? PlaySenseBLEErrorMessage.connectFailedFallback)
    }

    /// An ESTABLISHED connection dropping (only ever fires after `.connected` was reached) — port of the
    /// web's `onDisconnected`: one auto-reconnect attempt while `wantsConnection`, else `.disconnected`.
    func handleDisconnected(peripheral: any PlaySenseBLEPeripheral) {
        connectedPeripheral = nil
        guard wantsConnection else {
            setStatus(.disconnected)
            return
        }
        beginReconnectAttemptOrGiveUp(peripheral: peripheral)
    }

    private func beginReconnectAttemptOrGiveUp(peripheral: any PlaySenseBLEPeripheral) {
        guard reconnectAttempts < 1 else {
            setError(PlaySenseBLEErrorMessage.reconnectFailed)
            return
        }
        reconnectAttempts += 1
        setStatus(.reconnecting)
        connectedPeripheral = peripheral
        central.connect(peripheral)
    }

    func handleDiscoveredServiceUUIDs(_ uuids: [CBUUID], peripheral: any PlaySenseBLEPeripheral) {
        guard uuids.contains(PlaySenseBLEProtocol.serviceUUID) else {
            failConnection(freshMessage: PlaySenseBLEErrorMessage.connectFailedFallback)
            return
        }
        peripheral.discoverCharacteristics(
            uuid: PlaySenseBLEProtocol.characteristicUUID, inServiceWithUUID: PlaySenseBLEProtocol.serviceUUID
        )
    }

    func handleDiscoveredCharacteristicUUIDs(_ uuids: [CBUUID], peripheral: any PlaySenseBLEPeripheral) {
        guard uuids.contains(PlaySenseBLEProtocol.characteristicUUID) else {
            failConnection(freshMessage: PlaySenseBLEErrorMessage.connectFailedFallback)
            return
        }
        peripheral.setNotify(
            true, forCharacteristicUUID: PlaySenseBLEProtocol.characteristicUUID,
            inServiceWithUUID: PlaySenseBLEProtocol.serviceUUID
        )
    }

    func handleNotificationStateUpdate(isNotifying: Bool, peripheral: any PlaySenseBLEPeripheral) {
        guard isNotifying else {
            failConnection(freshMessage: PlaySenseBLEErrorMessage.connectFailedFallback)
            return
        }
        reconnectAttempts = 0
        persistIdentifier(peripheral.identifier)
        setStatus(.connected)
    }

    func handleCharacteristicValueUpdate(uuid: CBUUID, data: Data?) {
        guard uuid == PlaySenseBLEProtocol.characteristicUUID else { return }
        guard let data, let reading = PlaySenseBLEReadingDecoder.decode(data) else { return }
        onReading?(reading)
    }
}

// The real `CBCentralManagerDelegate`/`CBPeripheralDelegate` conformances (thin — see the untested-glue
// inventory in the type doc above) live in `PlaySenseDeviceManager+CoreBluetoothDelegate.swift`, split out
// purely to stay under SwiftLint's `file_length` cap — no behavioral significance.
