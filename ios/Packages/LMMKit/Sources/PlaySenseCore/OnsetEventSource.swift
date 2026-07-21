import Foundation

/// A live source of onset events — the shared shape D22's `LatencyCalibrator` and (per the plan) D23's
/// grading loop depend on, so either input path (the D21 mic pipeline or D25's PlaySense BLE hits) can
/// be swapped without touching the logic that consumes them.
///
/// `@MainActor`: every existing conformer wraps a `@MainActor` engine (`GameAudioEngine`), and every
/// consumer (`CalibrationRunner`, `CalibrationWizardModel`) already runs on the main actor, so isolating
/// the protocol itself avoids a cross-actor conformance warning (an error under Swift 6 mode) without
/// forcing conformers to hop off their natural actor.
///
/// Conformers: `PlaySenseAudio.MicOnsetEventSource` (wraps `GameAudioEngine`'s mic tap + `OnsetDetector`,
/// D21/D22) and, in D25, a PlaySense BLE hit source.
@MainActor
public protocol OnsetEventSource: AnyObject {
    /// Invoked for every detected onset while the source is running. Set this BEFORE calling `start()`.
    var onOnset: ((OnsetEvent) -> Void)? { get set }

    /// Begin producing onset events (installs the mic tap / starts BLE notifications).
    func start()

    /// Stop producing onset events and release any underlying resources (tap/subscription).
    func stop()
}
