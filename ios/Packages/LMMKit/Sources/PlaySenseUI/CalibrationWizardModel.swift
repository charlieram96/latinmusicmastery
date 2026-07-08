import PlaySenseAudio
import PlaySenseCore
import SwiftUI

/// The wizard's outer step, layered ABOVE `CalibrationPhase` (which only exists once a take has
/// actually been scheduled): `intro` (nothing running yet) → `running` (mirrors the live session's
/// countingIn/tapping phases) → `result` (a take just finished; retry/accept) → `stored` (accepted and
/// persisted) → `permissionDenied`/`engineError` (setup failed before a take could even start).
enum CalibrationWizardStep: Equatable {
    case intro
    case running(CalibrationPhase)
    case result(CalibrationOutcome)
    case stored(CalibrationRecord)
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
                if case let .result(outcome) = phase {
                    self.step = .result(outcome)
                } else {
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

    /// Discard the current take (success or failure) and return to the intro screen.
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

    private func teardown() {
        runner?.stop()
        runner = nil
        engine.teardown()
        sessionController.deactivate()
    }
}
