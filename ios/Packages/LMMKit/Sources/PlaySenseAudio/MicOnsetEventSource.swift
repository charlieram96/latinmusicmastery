import Foundation
import PlaySenseCore

/// Adapts the D21 mic pipeline (`GameAudioEngine.installMicTap`/`removeMicTap`, backed by `MicTap` +
/// `OnsetDetector`) to the shared ``OnsetEventSource`` protocol, so calibration and D23 grading can depend
/// on the protocol rather than the concrete mic plumbing — the same shape D25's BLE hit source will
/// implement.
///
/// It surfaces all three signals the live scorer needs:
/// - `.onset` → an ``OnsetEvent`` carrying the detector's onset frequency (via `onOnset`);
/// - `.chord` → the deferred post-strum chroma, stored keyed by `round(onsetTimestamp * 1000)` so
///   ``LiveScorer``'s `chromaProvider` can look it up at chord-grade time (`chroma(forOnsetKey:)`);
/// - an on-demand `currentPitch()` re-read of the detector's ring buffer, backing `LiveScorer`'s
///   `pitchFrequencyProvider` for the +100 ms deferred pitched path.
///
/// `.level` (the UI meter) is dropped. `MicTap` delivers messages on its drain queue at up to ~375/sec;
/// `start()` filters `.level` right there, before ever creating a `Task` — only `.onset` and `.chord` hop
/// to the main actor (to reach ``handle(_:)``, matching `GameAudioEngine`'s isolation and keeping the
/// chroma store single-serial-context with its `chroma(forOnsetKey:)` reader, which `LiveScorer` calls on
/// the main queue via its `RealDeferredScheduler`). Pre-filtering on the drain queue means `.level` never
/// spawns a `Task { @MainActor in … }` at all, instead of hopping over just to be dropped inside `handle`.
@MainActor
public final class MicOnsetEventSource: OnsetEventSource {
    public var onOnset: ((OnsetEvent) -> Void)?

    private let engine: GameAudioEngine
    private let config: OnsetConfig
    private var isRunning = false

    // Deferred post-onset chroma, keyed by the onset timestamp rounded to whole milliseconds — the exact
    // key `LiveScorer.chromaProvider` looks up. Bounded FIFO so a long take can't grow it without limit.
    private var chromaByOnsetKey: [Int: [Double]] = [:]
    private var chromaKeyOrder: [Int] = []
    private static let maxChromaEntries = 64

    public init(engine: GameAudioEngine, config: OnsetConfig) {
        self.engine = engine
        self.config = config
    }

    public func start() {
        guard !isRunning else { return }
        isRunning = true
        chromaByOnsetKey.removeAll()
        chromaKeyOrder.removeAll()
        engine.installMicTap(config: config) { [weak self] message in
            // Pre-filter on the drain queue, BEFORE spawning a Task: `.level` fires ~375/sec and this
            // source never consumes it, so hopping to the main actor for it would spam the cooperative
            // pool with ~375 no-op Tasks/sec for nothing. `needsMainActorHop` decides right here, on the
            // drain queue; only `.onset`/`.chord` go on to create a `Task`, `.level` returns with none
            // created at all.
            guard Self.needsMainActorHop(message) else { return }
            Task { @MainActor in self?.handle(message) }
        }
    }

    /// Whether `message` must reach the main actor to be handled (`.onset`/`.chord`, which touch
    /// `handle(_:)`'s main-actor-isolated state) or can be dropped right on the delivery queue (`.level`,
    /// ~375/sec and never consumed by this source). Pulled out as its own predicate — rather than inlined
    /// in the `installMicTap` closure — so `MicOnsetEventSourceTests` can assert `.level` never qualifies
    /// for a hop. `GameAudioEngine`/`MicTap` are concrete, hardware-backed types with no synthetic-message
    /// injection seam, so a live counting-executor/hop-counter test through `start()` itself isn't
    /// practical here; this predicate is the next best thing — it's the exact gate `start()` calls before
    /// ever constructing a `Task`, so a regression that stops filtering `.level` here fails this test.
    ///
    /// `nonisolated` (despite the enclosing `@MainActor` class): it must run synchronously on `MicTap`'s
    /// drain queue, inside the `installMicTap` callback, BEFORE any actor hop — that's the whole point.
    nonisolated static func needsMainActorHop(_ message: OnsetDetectorMessage) -> Bool {
        switch message {
        case .onset, .chord: return true
        case .level: return false
        }
    }

    public func stop() {
        guard isRunning else { return }
        isRunning = false
        engine.removeMicTap()
    }

    /// Map one detector message onto the source's outputs. Internal seam so `MicOnsetEventSourceTests` can
    /// drive the chroma-keying + onset-forwarding logic directly, with no live engine.
    func handle(_ message: OnsetDetectorMessage) {
        switch message {
        case let .onset(timestamp, energy, _, frequency):
            onOnset?(OnsetEvent(timestamp: timestamp, energy: energy, frequency: frequency))
        case let .chord(onsetTimestamp, chroma):
            recordChroma(onsetTimestamp: onsetTimestamp, chroma: chroma)
        case .level:
            break
        }
    }

    private func recordChroma(onsetTimestamp: Double, chroma: [Double]) {
        let key = Int((onsetTimestamp * 1000).rounded())
        if chromaByOnsetKey[key] == nil {
            chromaKeyOrder.append(key)
            if chromaKeyOrder.count > Self.maxChromaEntries {
                chromaByOnsetKey[chromaKeyOrder.removeFirst()] = nil
            }
        }
        chromaByOnsetKey[key] = chroma
    }

    /// The post-onset chroma recorded for `key` (`round(onsetTimestamp * 1000)`), or `nil` if none arrived
    /// yet. Backs ``LiveScorer``'s `chromaProvider`.
    public func chroma(forOnsetKey key: Int) -> [Double]? { chromaByOnsetKey[key] }

    /// On-demand re-read of the mic's current fundamental frequency (Hz) — backs ``LiveScorer``'s
    /// `pitchFrequencyProvider` for the deferred pitched-grade path. `nil` when no tap is running or no
    /// confident pitch is present.
    public func currentPitch() -> Double? { engine.currentMicPitch() }
}
