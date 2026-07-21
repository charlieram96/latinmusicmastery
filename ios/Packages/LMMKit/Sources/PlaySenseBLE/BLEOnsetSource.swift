import Foundation
import PlaySenseAudio
import PlaySenseCore
import QuartzCore

/// Adapts ``PlaySenseDeviceManager``'s BLE readings to the shared ``OnsetEventSource`` protocol — the
/// same seam `PlaySenseAudio.MicOnsetEventSource` implements for the mic path (D21), so `SessionCoordinator`
/// can swap the whole input pipeline without touching `LiveScorer`.
///
/// Port of `hooks/use-playsense-onsets.ts`'s onset-emission effect: each BLE reading's `piezos` array is
/// mapped through ``PlaySenseMapping`` (piezo index → drum surface) for the session's instrument, and
/// EVERY piezo `> 0` in a single reading becomes its own ``OnsetEvent`` — all sharing one timestamp, since
/// the timestamp is computed once per reading, before the per-piezo loop (mirrors the hook building
/// `newOnsets` from one `reading` inside a single effect run).
///
/// Two constructions:
/// - `instrument` provided (real gameplay): one event per piezo index that has a surface in that
///   instrument's mapping, `surface` set — the hook's per-instrument path.
/// - `instrument` nil (calibration): a single event per reading whenever ANY piezo is `> 0`, no surface —
///   port of the hook's separate always-on `subscribeToHits` path (`playsense-context.tsx`/
///   `use-playsense-onsets.ts`), which the calibration wizard uses and which deliberately ignores surface
///   identity (a tap-along calibration only cares about ONSET TIMING).
///
/// `timestamp` is `GameClock` host-seconds captured at the moment the reading is handled — i.e. BLE
/// notification ARRIVAL time on the same monotonic clock `t0`/mic onsets use. BLE notification jitter is
/// absorbed by the `.ble`-keyed `CalibrationRecord` offset, the same way the mic path's capture latency
/// is (plan: "BLE jitter absorbed by BLE-source calibration").
@MainActor
public final class BLEOnsetSource: OnsetEventSource {
    public var onOnset: ((OnsetEvent) -> Void)?
    /// Throttled `maxPiezo / 4095` meter — port of `use-playsense-onsets.ts`'s `setInputLevel(...)`,
    /// published on EVERY reading (not just ones that cross the onset threshold), separate from
    /// `OnsetEvent.energy` (the RAW piezo value, per the plan — never conflate the two).
    public var onInputLevel: ((Double) -> Void)?

    private let deviceManager: PlaySenseDeviceManager
    private let mapping: PlaySenseMapping?
    private var isRunning = false
    private var lastLevelUpdate: CFTimeInterval = -.greatestFiniteMagnitude

    /// Throttle interval for `onInputLevel` — mirrors the mic meter's throttled cadence (`OnsetDetector`'s
    /// `.level` messages arrive at up to ~375 Hz but the UI only needs a smooth meter); 30 Hz is plenty for
    /// a visual level meter while bounding how often a chatty firmware can push UI updates.
    private static let levelThrottleInterval: CFTimeInterval = 1.0 / 30.0

    public init(deviceManager: PlaySenseDeviceManager, instrument: Instrument?) {
        self.deviceManager = deviceManager
        self.mapping = instrument.flatMap { getPlaySenseMapping($0.rawValue) }
    }

    public func start() {
        guard !isRunning else { return }
        isRunning = true
        deviceManager.onReading = { [weak self] reading in self?.handle(reading) }
    }

    public func stop() {
        guard isRunning else { return }
        isRunning = false
        deviceManager.onReading = nil
    }

    /// Internal seam so `BLEOnsetSourceTests` can drive the mapping/multi-event/level logic directly, and
    /// so the DEBUG synthetic injector (`debugInject`) exercises the EXACT same path a real notification
    /// would, instead of duplicating the mapping logic.
    func handle(_ reading: PlaySenseBLEReading) {
        let timestamp = GameClock.hostSeconds(fromTicks: GameClock.now())
        if let mapping {
            for (index, value) in reading.piezos.enumerated() where value > 0 {
                guard let surface = mapping.piezoMap[index] else { continue }
                onOnset?(OnsetEvent(timestamp: timestamp, energy: value, surface: surface))
            }
        } else if let maxPiezo = reading.piezos.max(), maxPiezo > 0 {
            // Calibration path: any hit counts, surface identity is irrelevant to timing.
            onOnset?(OnsetEvent(timestamp: timestamp, energy: maxPiezo))
        }
        publishInputLevel(reading)
    }

    private func publishInputLevel(_ reading: PlaySenseBLEReading) {
        let now = CACurrentMediaTime()
        guard now - lastLevelUpdate >= Self.levelThrottleInterval else { return }
        lastLevelUpdate = now
        let maxPiezo = reading.piezos.max() ?? 0
        onInputLevel?(min(maxPiezo / 4095.0, 1))
    }

    #if DEBUG
    /// Simulator seam: injects a synthetic BLE reading through the EXACT SAME mapping/timestamp path a
    /// real CoreBluetooth notification would take (see `PlaySenseDeviceManager`'s module doc — CoreBluetooth
    /// has no radio on the Simulator). `SessionCoordinator`'s `debugSyntheticBLESession` flag drives this
    /// per expected event, the BLE analogue of the mic path's `debugAutoPlayOffsetMs` seam — but unlike
    /// that seam (which hand-builds an `OnsetEvent` directly, bypassing any onset source), this exercises
    /// the real `handle(_:)` surface-mapping code.
    public func debugInject(reading: PlaySenseBLEReading) {
        handle(reading)
    }
    #endif
}
