import LMMDesignSystem
import PlaySenseAudio
import PlaySenseBLE
import PlaySenseCore
import SwiftUI

/// The tap-along latency calibration wizard — PlaySenseUI's first real (non-debug) content. Mirrors the
/// web `CalibrationWizard` component's UX: an intro screen, a live count-in/tap-along screen (beat
/// pulse + progress), a result screen (offset/IQR + a widened-tolerance warning + retry/accept), and a
/// stored confirmation. Drives a real `GameAudioEngine` + mic tap; in DEBUG builds a "simulate taps"
/// control lets the wizard be exercised on the Simulator, which has no usable mic input.
public struct CalibrationWizardView: View {
    // Not `private`: `CalibrationWizardView+Interrupted.swift` (a same-module, different-file extension
    // covering the `.interrupted` step — split out purely to stay under SwiftLint's `type_body_length`
    // cap, same reason `CalibrationWizardModel` lives in its own file) needs to reach `model.retry()`.
    @StateObject var model: CalibrationWizardModel
    @Environment(\.scenePhase) private var scenePhase
    private let sourceType: CalibrationSourceType
    private let onFinished: (() -> Void)?

    public init(
        sourceType: CalibrationSourceType = .mic,
        bleDeviceManager: PlaySenseDeviceManager? = nil,
        onFinished: (() -> Void)? = nil
    ) {
        _model = StateObject(wrappedValue: CalibrationWizardModel(
            sourceType: sourceType, bleDeviceManager: bleDeviceManager
        ))
        self.sourceType = sourceType
        self.onFinished = onFinished
    }

    public var body: some View {
        ScrollView {
            VStack(spacing: LMMSpacing.lg) {
                header
                content
            }
            .padding(LMMSpacing.screen)
            .frame(maxWidth: 420)
            .frame(maxWidth: .infinity)
        }
        .background(LMMColor.background)
        .navigationTitle("Calibration")
        .onDisappear { model.cancel() }
        .onChange(of: scenePhase) { _, phase in
            // A phone call or Bluetooth route change surfaces as an `AudioSessionController` event and
            // is handled by the model directly; simply being backgrounded (home button / app switcher /
            // a full-screen system UI) does not, so the view forwards that transition explicitly — same
            // "never silently complete/persist a partial take" rationale, see `handleBackgrounding()`.
            if phase == .background { model.handleBackgrounding() }
        }
    }

    // MARK: - Header

    /// D25: label/icon now reflect `sourceType` — this used to always read "Microphone" even when
    /// calibrating BLE (harmless before D25, since `CalibrationWizardModel` silently used the mic for
    /// `.ble` too; now that `.ble` really does calibrate against the PlaySense device, the header would
    /// have been actively misleading left as-is).
    private var header: some View {
        VStack(spacing: LMMSpacing.sm) {
            HStack(spacing: LMMSpacing.xxs) {
                Image(systemName: sourceIcon)
                Text("Calibrating: \(sourceLabel)")
            }
            .font(LMMFont.eyebrow)
            .foregroundStyle(LMMColor.primary)
            .padding(.horizontal, LMMSpacing.xs)
            .padding(.vertical, 5)
            .background(Capsule().fill(LMMColor.primary.opacity(0.1)))
            .overlay(Capsule().strokeBorder(LMMColor.primary.opacity(0.3), lineWidth: 1))

            Image(systemName: sourceIcon)
                .font(.system(size: 22))
                .foregroundStyle(LMMColor.primary)
                .frame(width: 56, height: 56)
                .background(Circle().fill(LMMColor.primary.opacity(0.1)))
                .overlay(Circle().strokeBorder(LMMColor.primary.opacity(0.2), lineWidth: 1))

            Text("Audio Calibration")
                .font(LMMFont.title2)
                .foregroundStyle(LMMColor.foreground)
        }
    }

    private var sourceIcon: String {
        sourceType == .ble ? "dot.radiowaves.left.and.right" : "mic.fill"
    }

    private var sourceLabel: String {
        sourceType == .ble ? "PlaySense Device" : "Microphone"
    }

    // MARK: - Step content

    @ViewBuilder
    private var content: some View {
        switch model.step {
        case .intro:
            introContent
        case .permissionDenied:
            messageContent(
                "Microphone access is required to calibrate.",
                color: LMMColor.destructive,
                actionTitle: "Try Again"
            ) { Task { await model.start() } }
        case let .engineError(message):
            messageContent(
                "Couldn't start calibration: \(message)",
                color: LMMColor.destructive,
                actionTitle: "Try Again"
            ) { Task { await model.start() } }
        case let .running(phase):
            runningContent(phase)
        case let .result(outcome):
            resultContent(outcome)
        case let .stored(record):
            storedContent(record)
        case let .interrupted(reason):
            interruptedContent(reason)
        }
    }

    private var introContent: some View {
        VStack(spacing: LMMSpacing.md) {
            Text("Use headphones for best results. Calibration takes about 15 seconds.")
                .font(LMMFont.subheadline)
                .foregroundStyle(LMMColor.mutedForeground)
                .multilineTextAlignment(.center)
            Button("Start Calibration") { Task { await model.start() } }
                .buttonStyle(.lmmPrimary)
        }
    }

    private func messageContent(
        _ message: String,
        color: Color,
        actionTitle: String,
        action: @escaping () -> Void
    ) -> some View {
        VStack(spacing: LMMSpacing.md) {
            Text(message)
                .font(LMMFont.subheadline)
                .foregroundStyle(color)
                .multilineTextAlignment(.center)
            Button(actionTitle, action: action)
                .buttonStyle(.lmmPrimary)
        }
    }

    // MARK: - Running (count-in + tap-along)

    private func runningContent(_ phase: CalibrationPhase) -> some View {
        let beat = Self.tappingBeat(for: phase)
        let total = LatencyCalibrator.measuredBeats
        let progress = total > 0 ? Double(beat) / Double(total) : 0

        return VStack(spacing: LMMSpacing.md) {
            Text(Self.statusLine(for: phase))
                .font(LMMFont.body)
                .foregroundStyle(LMMColor.foreground)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: LMMRadius.pill).fill(LMMColor.secondary)
                    RoundedRectangle(cornerRadius: LMMRadius.pill)
                        .fill(LMMColor.amberGradient)
                        .frame(width: geo.size.width * progress)
                        .animation(.easeOut(duration: 0.2), value: progress)
                }
            }
            .frame(height: 8)

            ZStack {
                Circle().fill(LMMColor.primary.opacity(0.25)).frame(width: 44, height: 44)
                Circle().fill(LMMColor.primary).frame(width: 22, height: 22)
                    .scaleEffect(beat > 0 ? 1.15 : 1)
                    .animation(.easeOut(duration: 0.15), value: beat)
            }
            .frame(height: 64)

            HStack(spacing: LMMSpacing.xxs) {
                ForEach(0..<total, id: \.self) { index in
                    Circle()
                        .fill(index < beat ? LMMColor.primary : LMMColor.secondary)
                        .frame(width: 8, height: 8)
                }
            }

            #if DEBUG
            simulateTapControls
            #endif
        }
    }

    #if DEBUG
    private var simulateTapControls: some View {
        VStack(spacing: LMMSpacing.xs) {
            Text("DEBUG — simulate taps (no mic on Simulator)")
                .font(LMMFont.caption)
                .foregroundStyle(LMMColor.mutedForeground)
            HStack(spacing: LMMSpacing.xs) {
                ForEach([0, 20, 45], id: \.self) { offsetMs in
                    Button("+\(offsetMs)ms") { model.simulateTap(offsetMs: Double(offsetMs)) }
                        .buttonStyle(.lmmSecondary)
                }
            }
        }
        .padding(.top, LMMSpacing.sm)
    }
    #endif

    private static func statusLine(for phase: CalibrationPhase) -> String {
        switch phase {
        case .intro, .countingIn:
            return "Count-in… get ready to tap!"
        case let .tapping(beat):
            return "Tap along! \(beat) / \(LatencyCalibrator.measuredBeats)"
        case .result, .interrupted:
            // `.interrupted` is pulled up to its own top-level `CalibrationWizardStep` (see
            // `CalibrationWizardModel`'s `onPhaseChange`), so `runningContent` never actually renders it
            // — this case only exists to keep the switch exhaustive over `CalibrationPhase`.
            return ""
        }
    }

    private static func tappingBeat(for phase: CalibrationPhase) -> Int {
        if case let .tapping(beat) = phase { return beat }
        return 0
    }

    // MARK: - Result

    @ViewBuilder
    private func resultContent(_ outcome: CalibrationOutcome) -> some View {
        switch outcome {
        case let .success(record):
            successResult(record)
        case let .failure(failure):
            failureResult(failure)
        }
    }

    private func successResult(_ record: CalibrationRecord) -> some View {
        VStack(spacing: LMMSpacing.md) {
            ZStack {
                Circle().fill(LMMColor.success.opacity(0.15)).frame(width: 56, height: 56)
                Image(systemName: "checkmark")
                    .font(.system(size: 22, weight: .bold))
                    .foregroundStyle(LMMColor.success)
            }
            Text("Calibrated")
                .font(LMMFont.headline)
                .foregroundStyle(LMMColor.success)

            VStack(spacing: LMMSpacing.xxs) {
                Text("Latency: \(Self.formatMs(record.offsetMs))")
                Text("Consistency: \(Self.formatMs(record.iqrMs)) IQR")
            }
            .font(.system(.footnote, design: .monospaced))
            .foregroundStyle(LMMColor.mutedForeground)

            if record.widenMs > 0 {
                Label(
                    "Calibration approximate — tolerance windows widened",
                    systemImage: "exclamationmark.triangle.fill"
                )
                    .font(LMMFont.caption)
                    .foregroundStyle(LMMColor.gold)
                    .multilineTextAlignment(.center)
            }

            HStack(spacing: LMMSpacing.sm) {
                Button("Recalibrate") { model.retry() }.buttonStyle(.lmmSecondary)
                Button("Continue") { model.accept() }.buttonStyle(.lmmPrimary)
            }
        }
    }

    private static func formatMs(_ value: Double) -> String {
        String(format: "%.1fms", value)
    }

    // MARK: - Stored

    private func storedContent(_ record: CalibrationRecord) -> some View {
        VStack(spacing: LMMSpacing.md) {
            Image(systemName: "checkmark.seal.fill")
                .font(.system(size: 40))
                .foregroundStyle(LMMColor.success)
            Text("Calibration saved")
                .font(LMMFont.headline)
                .foregroundStyle(LMMColor.foreground)
            Text("\(Self.formatMs(record.offsetMs)) latency saved for this route.")
                .font(LMMFont.subheadline)
                .foregroundStyle(LMMColor.mutedForeground)
            if let onFinished {
                Button("Done", action: onFinished).buttonStyle(.lmmPrimary)
            }
        }
    }
}
