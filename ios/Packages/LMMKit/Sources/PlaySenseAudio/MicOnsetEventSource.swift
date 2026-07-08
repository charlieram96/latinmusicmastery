import Foundation
import PlaySenseCore

/// Adapts the D21 mic pipeline (`GameAudioEngine.installMicTap`/`removeMicTap`, backed by `MicTap` +
/// `OnsetDetector`) to the shared ``OnsetEventSource`` protocol, so calibration (and later D23 grading)
/// can depend on the protocol rather than the concrete mic plumbing — the same shape D25's BLE hit
/// source will implement.
///
/// Only `.onset` messages become `OnsetEvent`s; `.level` (UI meter) and `.chord` (post-onset chroma,
/// D23's concern) are dropped. `MicTap` delivers `onMessage` on its drain queue — `onOnset` is
/// dispatched to the main actor to match `GameAudioEngine`'s isolation.
@MainActor
public final class MicOnsetEventSource: OnsetEventSource {
    public var onOnset: ((OnsetEvent) -> Void)?

    private let engine: GameAudioEngine
    private let config: OnsetConfig
    private var isRunning = false

    public init(engine: GameAudioEngine, config: OnsetConfig) {
        self.engine = engine
        self.config = config
    }

    public func start() {
        guard !isRunning else { return }
        isRunning = true
        engine.installMicTap(config: config) { [weak self] message in
            guard case let .onset(timestamp, energy, _, frequency) = message else { return }
            let event = OnsetEvent(timestamp: timestamp, energy: energy, frequency: frequency)
            Task { @MainActor in self?.onOnset?(event) }
        }
    }

    public func stop() {
        guard isRunning else { return }
        isRunning = false
        engine.removeMicTap()
    }
}
