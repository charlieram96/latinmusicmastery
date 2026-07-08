import PlaySenseAudio
import PlaySenseCore
import SwiftUI

/// The wizard's outer step, layered ABOVE `CalibrationPhase` (which only exists once a take has
/// actually been scheduled): `intro` (nothing running yet) → `running` (mirrors the live session's
/// countingIn/tapping phases) → `result` (a take just finished; retry/accept) → `stored` (accepted and
/// persisted) → `permissionDenied`/`engineError` (setup failed before a take could even start).
/// `interrupted` is reachable from `running` only: an audio-session disruption (interruption/route
/// change/backgrounding) aborted the take before it produced a result — see
/// `handleSessionEvent(_:)`/`handleBackgrounding()`. There is deliberately no `Continue`/accept path off
/// of it, only `retry()` (back to `.intro`): no `CalibrationOutcome` exists for an interrupted take, so
/// there is nothing to persist.
enum CalibrationWizardStep: Equatable {
    case intro
    case running(CalibrationPhase)
    case result(CalibrationOutcome)
    case stored(CalibrationRecord)
    case interrupted(CalibrationInterruptionReason)
    case permissionDenied
    case engineError(String)
}

/// Engine-glue view-model for ``CalibrationWizardView``: owns one `GameAudioEngine` +
/// `AudioSessionController` + `CalibrationRunner` for the lifetime of a single wizard presentation, and
/// republishes `CalibrationRunner`'s phase callbacks as `CalibrationWizardStep` for SwiftUI.
@MainActor
final class CalibrationWizardModel: ObservableObject {
    @Published private(set) var step: CalibrationWizardStep = .intro

    private let sessionController: AudioSessionController
    private let engine = GameAudioEngine()
    private let sourceType: CalibrationSourceType
    private let instrumentConfig: OnsetConfig
    private var runner: CalibrationRunner?

    init(
        sessionController: AudioSessionController? = nil,
        sourceType: CalibrationSourceType = .mic,
        instrumentConfig: OnsetConfig = getInstrumentConfig(.conga)
    ) {
        // `AudioSessionController()` is a MainActor-isolated initializer; a default PARAMETER value is
        // evaluated at the (possibly non-isolated) call site, not inside this init's body, so it cannot
        // be the default expression directly — construct it here instead, where the init body already
        // runs on the main actor (inherited from this class's `@MainActor`).
        self.sessionController = sessionController ?? AudioSessionController()
        self.sourceType = sourceType
        self.instrumentConfig = instrumentConfig

        // Wired here (not just inside `start()`) so it's in place for the ENTIRE wizard presentation,
        // covering every take the user runs (including retries) without re-wiring per-take. All stored
        // properties are set by this point, so capturing `self` (weakly) is safe.
        self.sessionController.onEvent = { [weak self] event in
            self?.handleSessionEvent(event)
        }
    }

    /// Request mic permission, configure the session, and start a fresh calibration take.
    func start() async {
        let granted = await sessionController.requestMicrophonePermission()
        guard granted else {
            step = .permissionDenied
            return
        }
        do {
            let actual = try sessionController.configure()
            engine.prepare()
            let onsetSource = MicOnsetEventSource(engine: engine, config: instrumentConfig)
            let routeKey = CalibrationStore.routeKey(for: sessionController.currentRouteInfo)
            let newRunner = CalibrationRunner(
                engine: engine, onsetSource: onsetSource, routeKey: routeKey, sourceType: sourceType
            )
            newRunner.onPhaseChange = { [weak self] phase in
                guard let self else { return }
                switch phase {
                case let .result(outcome):
                    self.step = .result(outcome)
                case let .interrupted(reason):
                    self.step = .interrupted(reason)
                default:
                    self.step = .running(phase)
                }
            }
            runner = newRunner
            step = .running(.intro)
            try newRunner.start()
            _ = actual // negotiated sample rate/IO buffer — not surfaced in this wizard's UI
        } catch {
            step = .engineError(error.localizedDescription)
        }
    }

    /// Discard the current take (success, failure, or interrupted) and return to the intro screen. This
    /// is also the ONLY way forward from `.interrupted` (no `Continue`/accept path exists for it) —
    /// which matters for a `.routeChanged` interruption specifically: going back to `.intro` means the
    /// NEXT `start()` re-reads `sessionController.currentRouteInfo` from scratch, so a route change is
    /// never silently ignored/retried against a route that no longer exists.
    func retry() {
        runner?.stop()
        runner = nil
        step = .intro
    }

    /// Persist a successful result and move to the terminal `stored` step.
    func accept() {
        guard case let .result(.success(record)) = step else { return }
        CalibrationStore.save(record)
        step = .stored(record)
        teardown()
    }

    /// Tear down without saving (wizard dismissed / skipped).
    func cancel() {
        teardown()
    }

    #if DEBUG
    /// Simulator test seam: injects a synthetic tap `offsetMs` from the CURRENTLY nearest expected
    /// click, bypassing the mic entirely (the Simulator has no usable mic input). See
    /// `CalibrationRunner.simulateTap` — this is the same call the debug screen's buttons use.
    func simulateTap(offsetMs: Double) {
        runner?.simulateTap(offsetMs: offsetMs)
    }
    #endif

    // MARK: - Interruption handling

    /// Called by ``CalibrationWizardView`` on a SwiftUI `scenePhase` transition to `.background`.
    /// `scenePhase` is a SwiftUI concept, not something `AudioSessionController` surfaces as an
    /// `AudioSessionEvent` — the view forwards it here explicitly so backgrounding gets the SAME
    /// "never silently complete/persist a partial take" treatment as a real audio-session disruption.
    func handleBackgrounding() {
        guard case .running = step, let runner else { return }
        runner.interrupt(reason: .backgrounded)
    }

    /// `AudioSessionController.onEvent` callback (wired in `init`). Only `.interruption(.began)` and
    /// `.routeChanged` abort a take, and ONLY while one is actually in flight (`step` is `.running`) —
    /// this is what guarantees an interruption arriving after `.result` (or with no take running at all)
    /// never touches an already-completed/persisted outcome.
    private func handleSessionEvent(_ event: AudioSessionEvent) {
        guard case .running = step, let runner else { return }
        switch event {
        case .interruption(.began):
            runner.interrupt(reason: .audioInterruption)
        case .routeChanged:
            // The take's `routeKey` was resolved from the route at `start()` time; once the route has
            // changed, that key no longer describes reality, so this can't just "resume" — the take is
            // aborted the same as any other disruption, and the ONLY way forward is `retry()`, which
            // returns to `.intro` and re-reads `sessionController.currentRouteInfo` fresh on the next
            // `start()`.
            runner.interrupt(reason: .routeChanged)
        case .interruption(.ended), .mediaServicesReset:
            // `.interruption(.ended)` (the system telling us we may resume) arrives AFTER `.began` already
            // aborted the take — nothing left to do. `.mediaServicesReset` (the whole audio server
            // restarting) is a far more severe, whole-engine-invalidating event that would need a full
            // `GameAudioEngine` rebuild to recover from; that's beyond this fix's scope (not reported),
            // so it's intentionally left unhandled here rather than papered over.
            break
        }
    }

    private func teardown() {
        runner?.stop()
        runner = nil
        engine.teardown()
        sessionController.deactivate()
    }
}
