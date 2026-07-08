#if DEBUG
import AVFoundation
import Combine
import LMMDesignSystem
import PlaySenseAudio
import PlaySenseCore
import SwiftUI

/// Observes the mic-tap `OnsetDetector` output for the debug screen: a throttled input level (≈15 fps)
/// for a meter, plus the most recent onset. `ingest(_:)` is called from the drain queue and hops to the
/// main actor.
@MainActor
final class PlaySenseInputMonitor: ObservableObject {
    @Published var level: Double = 0
    @Published var lastOnset: String = "—"
    @Published var onsetCount = 0
    private var lastLevelUpdate = Date.distantPast

    nonisolated func ingest(_ message: OnsetDetectorMessage) {
        Task { @MainActor in self.apply(message) }
    }

    private func apply(_ message: OnsetDetectorMessage) {
        switch message {
        case let .level(value):
            let now = Date()
            if now.timeIntervalSince(lastLevelUpdate) >= 1.0 / 15.0 {
                level = value
                lastLevelUpdate = now
            }
        case let .onset(timestamp, energy, fluxConfirmed, frequency):
            onsetCount += 1
            let freqText = frequency.map { String(format: "%.1f Hz", $0) } ?? "—"
            lastOnset = String(format: "t=%.3fs  e=%.4f  f=%@  flux=%@",
                               timestamp, energy, freqText, fluxConfirmed ? "yes" : "no")
        case .chord:
            break
        }
    }
}

/// DEBUG-only harness for the D20 audio foundation (same pattern as `NotationDebugView`, reached from a
/// `#if DEBUG` row on the Profile tab). Configures the session, then plays a 4-beat count-in + 8-beat
/// click track plus one synthesized backing stem, all locked to a resolved `t0`, and prints the
/// resolved anchor, negotiated IO parameters, and current route.
public struct PlaySenseAudioDebugView: View {
    @State private var log: [String] = []
    @State private var engine: GameAudioEngine?
    @State private var controller = AudioSessionController()
    @State private var includeBacking = true
    @State private var isRunning = false
    @State private var micActive = false
    @StateObject private var monitor = PlaySenseInputMonitor()

    public init() {}

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: LMMSpacing.md) {
                Toggle("Include backing stem (synth tone)", isOn: $includeBacking)
                    .font(LMMFont.body)
                    .tint(LMMColor.primary)

                Button {
                    Task { await run() }
                } label: {
                    Text(isRunning ? "Running…" : "Configure + Start count-in + clicks")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.lmmPrimary)
                .disabled(isRunning)

                Button {
                    toggleMic()
                } label: {
                    Text(micActive ? "Stop mic onset detection" : "Start mic onset detection (conga)")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.lmmSecondary)
                .disabled(engine == nil)

                if micActive {
                    inputMeter
                }

                Button {
                    stop()
                } label: {
                    Text("Stop / teardown").frame(maxWidth: .infinity)
                }
                .buttonStyle(.lmmSecondary)

                VStack(alignment: .leading, spacing: LMMSpacing.xxs) {
                    ForEach(Array(log.enumerated()), id: \.offset) { _, line in
                        Text(line)
                            .font(.system(.footnote, design: .monospaced))
                            .foregroundStyle(LMMColor.foreground)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                }
                .padding(LMMSpacing.sm)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(
                    RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous).fill(LMMColor.surface)
                )
            }
            .padding(LMMSpacing.screen)
        }
        .background(LMMColor.background)
        .navigationTitle("Audio Debug")
    }

    private var inputMeter: some View {
        VStack(alignment: .leading, spacing: LMMSpacing.xs) {
            Text("Input level")
                .font(LMMFont.caption)
                .foregroundStyle(LMMColor.mutedForeground)
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    RoundedRectangle(cornerRadius: LMMRadius.sm, style: .continuous)
                        .fill(LMMColor.surface)
                    RoundedRectangle(cornerRadius: LMMRadius.sm, style: .continuous)
                        .fill(LMMColor.primary)
                        .frame(width: geo.size.width * CGFloat(min(1, monitor.level * 4)))
                }
            }
            .frame(height: 14)
            Text("last onset: \(monitor.lastOnset)")
                .font(.system(.footnote, design: .monospaced))
                .foregroundStyle(LMMColor.foreground)
            Text("onset count: \(monitor.onsetCount)")
                .font(LMMFont.caption)
                .foregroundStyle(LMMColor.mutedForeground)
        }
        .padding(LMMSpacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: LMMRadius.md, style: .continuous).fill(LMMColor.surface)
        )
    }

    private func toggleMic() {
        guard let engine else { return }
        if micActive {
            engine.removeMicTap()
            micActive = false
            append("mic tap removed")
        } else {
            let config = getInstrumentConfig(.conga)
            engine.installMicTap(config: config) { [monitor] message in
                monitor.ingest(message)
            }
            micActive = true
            append("mic tap installed (conga config)")
        }
    }

    @MainActor
    private func run() async {
        isRunning = true
        log.removeAll()

        let granted = await controller.requestMicrophonePermission()
        append("mic permission granted: \(granted)")

        do {
            let actual = try controller.configure()
            append(String(format: "session: %.0f Hz, IO buffer %.2f ms",
                          actual.sampleRate, actual.ioBufferDuration * 1000))
            append(String(format: "latency in %.1f ms / out %.1f ms",
                          actual.inputLatency * 1000, actual.outputLatency * 1000))
            let route = controller.currentRouteInfo
            let outputs = route.outputs.map(\.portName).joined(separator: ", ")
            append("out: \(outputs) [\(route.primaryOutputCategory.rawValue)]")
            append("bluetooth output: \(route.isBluetoothOutput)")

            let audioEngine = GameAudioEngine(sampleRate: actual.sampleRate)
            if includeBacking {
                audioEngine.loadBackingBuffers([Self.syntheticStem(sampleRate: actual.sampleRate)])
                audioEngine.setBackingMode(.speakerSafe)
            }
            audioEngine.prepare()

            let clicks = MetronomeSchedule.clicks(bpm: 120, beatsPerMeasure: 4, countInBeats: 4, exerciseBeats: 8)
            let resolved = try audioEngine.start(t0Delay: 2.5, clicks: clicks)
            engine = audioEngine

            append("scheduled \(clicks.count) clicks")
            append(String(format: "t0 hostSeconds: %.4f", resolved.hostSeconds))
            append("t0 mixerSampleTime: \(resolved.mixerSampleTime)")
        } catch {
            append("ERROR: \(error.localizedDescription)")
        }
        isRunning = false
    }

    private func stop() {
        if let engine, micActive {
            append("mic drops: \(engine.micDropCount)")
        }
        engine?.teardown()
        engine = nil
        micActive = false
        controller.deactivate()
        append("stopped + torn down")
    }

    private func append(_ line: String) {
        log.append(line)
        print("[AudioDebug] \(line)")
    }

    /// A 3-second 220 Hz tone, so a backing stem is audible without any bundled asset.
    private static func syntheticStem(sampleRate: Double) -> AVAudioPCMBuffer {
        let frames = Int(sampleRate * 3)
        let format = AVAudioFormat(standardFormatWithSampleRate: sampleRate, channels: 1)!
        let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(frames))!
        buffer.frameLength = AVAudioFrameCount(frames)
        let channel = buffer.floatChannelData![0]
        for frame in 0..<frames {
            channel[frame] = 0.2 * Float(sin(2 * Double.pi * 220 * Double(frame) / sampleRate))
        }
        return buffer
    }
}
#endif
