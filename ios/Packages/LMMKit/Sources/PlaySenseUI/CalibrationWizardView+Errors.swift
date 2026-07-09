import LMMDesignSystem
import PlaySenseAudio
import SwiftUI

/// The two "the take didn't succeed" screens — a computed `.failure` result and an aborted
/// `.interrupted` take (an audio-session disruption or SwiftUI `scenePhase` backgrounding, see
/// `CalibrationWizardModel.handleSessionEvent(_:)`/`handleBackgrounding()`). Split into its own file (an
/// extension, not a nested type) purely to keep `CalibrationWizardView`'s primary declaration under
/// SwiftLint's `type_body_length` cap — same reason the wizard's model/view were already split across
/// `CalibrationWizardModel.swift` + `CalibrationWizardView.swift`, no behavioral significance.
extension CalibrationWizardView {

    // MARK: - Failure (a computed, terminal CalibrationOutcome.failure)

    func failureResult(_ failure: CalibrationFailure) -> some View {
        VStack(spacing: LMMSpacing.md) {
            ZStack {
                Circle().fill(LMMColor.destructive.opacity(0.15)).frame(width: 56, height: 56)
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(LMMColor.destructive)
            }
            Text(Self.failureMessage(failure))
                .font(LMMFont.subheadline)
                .foregroundStyle(LMMColor.destructive)
                .multilineTextAlignment(.center)
            Button(lmmString("common.tryAgain")) { model.retry() }.buttonStyle(.lmmPrimary)
        }
    }

    /// Ported 1:1 from `use-calibration.ts`'s three `calibrationError` messages.
    static func failureMessage(_ failure: CalibrationFailure) -> String {
        switch failure {
        case let .notEnoughTaps(detected, minimum):
            return lmmFormat("calibration.failure.notEnoughTaps", detected, minimum)
        case let .notEnoughValidTaps(valid, minimum):
            return lmmFormat("calibration.failure.notEnoughValidTaps", valid, minimum)
        case .tooInconsistent:
            return lmmString("calibration.failure.tooInconsistent")
        }
    }

    // MARK: - Interrupted (aborted mid-take by an audio-session disruption; never a computed outcome)

    /// No `Continue`/accept path here — deliberately: an interrupted take never produced a
    /// `CalibrationOutcome`, so there is nothing to persist. `Retry` (`model.retry()`) is the only way
    /// forward, back to the intro screen (see `CalibrationWizardModel.retry()`'s doc comment for why
    /// that matters specifically for a route-change interruption).
    func interruptedContent(_ reason: CalibrationInterruptionReason) -> some View {
        VStack(spacing: LMMSpacing.md) {
            ZStack {
                Circle().fill(LMMColor.destructive.opacity(0.15)).frame(width: 56, height: 56)
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.system(size: 20))
                    .foregroundStyle(LMMColor.destructive)
            }
            Text(lmmString("calibration.interrupted.title"))
                .font(LMMFont.headline)
                .foregroundStyle(LMMColor.destructive)
            Text(Self.interruptionMessage(reason))
                .font(LMMFont.subheadline)
                .foregroundStyle(LMMColor.mutedForeground)
                .multilineTextAlignment(.center)
            Button(lmmString("common.retry")) { model.retry() }.buttonStyle(.lmmPrimary)
        }
    }

    static func interruptionMessage(_ reason: CalibrationInterruptionReason) -> String {
        switch reason {
        case .audioInterruption:
            return lmmString("calibration.interrupted.audio")
        case .routeChanged:
            return lmmString("calibration.interrupted.route")
        case .backgrounded:
            return lmmString("calibration.interrupted.backgrounded")
        }
    }
}
