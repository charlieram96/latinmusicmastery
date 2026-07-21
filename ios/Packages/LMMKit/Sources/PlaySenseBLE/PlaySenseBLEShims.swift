import CoreBluetooth
import Foundation

// Minimal protocol wrappers around `CBCentralManager`/`CBPeripheral`'s API surface, so
// `PlaySenseDeviceManager`'s scan/connect/subscribe decision logic can be driven — and unit-tested —
// through a fake central + fake peripherals, with zero real CoreBluetooth objects. CoreBluetooth is
// inert on the Simulator (no real radio) and `CBService`/`CBCharacteristic` have no public initializers
// at all, so a fake conforming to these protocols is the ONLY way to exercise the manager's logic without
// live hardware — this is D25's "CBCentralManager protocol shim" from the plan.
//
// The shims deliberately mirror `CBCentralManager`/`CBPeripheral`'s real method names/signatures wherever
// they already match exactly (`scanForPeripherals`, `stopScan`, `discoverServices`, `state`) — those
// conform for FREE, no adapter code at all. A method needs a distinctly-named adapter ONLY where a real
// CoreBluetooth signature takes/returns a CONCRETE `CBPeripheral`/`CBService`/`CBCharacteristic` where the
// shim protocol needs an existential (`connect`, `cancelConnection`, `retrieveKnownPeripheral`) or needs
// to resolve a service/characteristic BY UUID that only the real object can look up in its own
// `.services`/`.characteristics` (`discoverCharacteristics(uuid:inServiceWithUUID:)`,
// `setNotify(_:forCharacteristicUUID:inServiceWithUUID:)`). Those adapters are the module's untested
// glue — deliberately confined to one-or-two-line lookups, never carrying decision logic (see each
// extension below and `PlaySenseDeviceManager`'s module doc for the full untested-glue inventory).

/// Shim for `CBCentralManager`. Real conformance is `extension CBCentralManager: PlaySenseBLECentralManaging`
/// below.
@MainActor
public protocol PlaySenseBLECentralManaging: AnyObject {
    var state: CBManagerState { get }
    func scanForPeripherals(withServices services: [CBUUID]?, options: [String: Any]?)
    func stopScan()
    /// Adapter: real `CBCentralManager.connect(_:options:)` takes a concrete `CBPeripheral`; this shim
    /// downcasts. See the module doc's untested-glue note.
    func connect(_ peripheral: any PlaySenseBLEPeripheral)
    /// Adapter: same reason as `connect(_:)`.
    func cancelConnection(_ peripheral: any PlaySenseBLEPeripheral)
    /// Adapter: real `retrievePeripherals(withIdentifiers:)` returns `[CBPeripheral]`; wrapped as an
    /// existential array and narrowed to the single identifier `PlaySenseDeviceManager` actually looks up.
    func retrieveKnownPeripheral(withIdentifier identifier: UUID) -> (any PlaySenseBLEPeripheral)?
}

/// Shim for `CBPeripheral`. Real conformance is `extension CBPeripheral: PlaySenseBLEPeripheral` below.
@MainActor
public protocol PlaySenseBLEPeripheral: AnyObject {
    var identifier: UUID { get }
    var name: String? { get }
    /// Adapter: `CBPeripheral.delegate` is a settable property, not a method; this shim exposes it as one
    /// so the protocol has no property-of-a-concrete-delegate-type requirement.
    func setDelegate(_ delegate: CBPeripheralDelegate)
    func discoverServices(_ serviceUUIDs: [CBUUID]?)
    /// Adapter: looks up the already-discovered `CBService` with `serviceUUID` on `self.services` and
    /// calls the real `discoverCharacteristics(_:for:)` on it. Untested glue (needs a real, already
    /// service-discovered `CBPeripheral`) — genuinely thin: one lookup, one forwarding call.
    func discoverCharacteristics(uuid: CBUUID, inServiceWithUUID serviceUUID: CBUUID)
    /// Adapter: same shape as `discoverCharacteristics(uuid:inServiceWithUUID:)`, one level deeper
    /// (service → characteristic).
    func setNotify(_ enabled: Bool, forCharacteristicUUID uuid: CBUUID, inServiceWithUUID serviceUUID: CBUUID)
}

// MARK: - Real conformances (the module's untested glue — see doc comment above)

extension CBCentralManager: PlaySenseBLECentralManaging {
    public func connect(_ peripheral: any PlaySenseBLEPeripheral) {
        guard let cbPeripheral = peripheral as? CBPeripheral else { return }
        connect(cbPeripheral, options: nil)
    }

    public func cancelConnection(_ peripheral: any PlaySenseBLEPeripheral) {
        guard let cbPeripheral = peripheral as? CBPeripheral else { return }
        cancelPeripheralConnection(cbPeripheral)
    }

    public func retrieveKnownPeripheral(withIdentifier identifier: UUID) -> (any PlaySenseBLEPeripheral)? {
        retrievePeripherals(withIdentifiers: [identifier]).first
    }
}

extension CBPeripheral: PlaySenseBLEPeripheral {
    public func setDelegate(_ delegate: CBPeripheralDelegate) {
        self.delegate = delegate
    }

    public func discoverCharacteristics(uuid: CBUUID, inServiceWithUUID serviceUUID: CBUUID) {
        guard let service = services?.first(where: { $0.uuid == serviceUUID }) else { return }
        discoverCharacteristics([uuid], for: service)
    }

    public func setNotify(_ enabled: Bool, forCharacteristicUUID uuid: CBUUID, inServiceWithUUID serviceUUID: CBUUID) {
        guard
            let service = services?.first(where: { $0.uuid == serviceUUID }),
            let characteristic = service.characteristics?.first(where: { $0.uuid == uuid })
        else { return }
        setNotifyValue(enabled, for: characteristic)
    }
}

#if DEBUG
/// A `PlaySenseBLECentralManaging` that never calls back — for `SessionCoordinator`'s DEBUG synthetic/demo
/// bypasses (`debugSyntheticBLESession`, `debugShowPlaysenseDevicePicker()`).
///
/// A REAL `CBCentralManager` reports its state via `centralManagerDidUpdateState(_:)` as soon as it's
/// constructed (with a delegate) — regardless of whether `scanForPeripherals` is ever called. On the
/// Simulator (no radio) that state is typically `.unsupported`/`.unauthorized`, which
/// `PlaySenseDeviceManager.handleCentralStateUpdate` correctly reports as an error — but for a DEBUG demo
/// that has already forced a synthetic "connected"/"devices found" state, that real, unrelated callback
/// arrives ~100ms later and overwrites the forced state out from under it (discovered the hard way: D25's
/// screenshot harness saw the mode-select screen re-appear after the device picker had already rendered
/// correctly). Using this no-op instead of a real `CBCentralManager` for debug-only constructions removes
/// the race entirely — no real Bluetooth stack, no delegate callback, ever.
@MainActor
public final class NoOpBLECentralManager: PlaySenseBLECentralManaging {
    public var state: CBManagerState = .poweredOn
    public init() {}
    public func scanForPeripherals(withServices services: [CBUUID]?, options: [String: Any]?) {}
    public func stopScan() {}
    public func connect(_ peripheral: any PlaySenseBLEPeripheral) {}
    public func cancelConnection(_ peripheral: any PlaySenseBLEPeripheral) {}
    public func retrieveKnownPeripheral(withIdentifier identifier: UUID) -> (any PlaySenseBLEPeripheral)? { nil }
}
#endif
