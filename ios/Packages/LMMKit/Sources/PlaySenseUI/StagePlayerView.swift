import LMMDesignSystem
import PlaySenseCore
import PlaySenseHighway
import ScoreModel
import SpriteKit
import SwiftUI

/// The session's face: a full-viewport ``HighwayScene`` (the SpriteKit port of the web's Obsidian
/// Glass highway) hosted in a `SpriteView` at 120 fps, with SwiftUI chrome overlaid for the count-in,
/// HUD, grade/combo flares, quit control, and results — matching the web's DOM/canvas split where the
/// canvas draws the game and the DOM owns the chrome.
///
/// The playable core is the unchanged D23 ``SessionCoordinator``; a ``HighwayBridge`` feeds the scene
/// each frame and never touches `LiveScorer`. ``DebugStageView`` stays available behind `#if DEBUG`
/// as the numbers-only harness.
public struct StagePlayerView: View {
    @State private var coordinator = SessionCoordinator()
    @State private var scene: HighwayScene
    @State private var bridge: HighwayBridge?
    @State private var didPresent = false
    @State private var comboFlare = false
    @Environment(\.scenePhase) private var scenePhase

    private let exercise: ExerciseDefinition
    private let showsDebugOverlay: Bool

    public init(exercise: ExerciseDefinition = StagePlayerView.sampleExercise, showsDebugOverlay: Bool = false) {
        self.exercise = exercise
        self.showsDebugOverlay = showsDebugOverlay
        _scene = State(initialValue: HighwayScene(size: CGSize(width: 402, height: 874)))
    }

    public var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            SpriteView(
                scene: scene,
                preferredFramesPerSecond: 120,
                options: [.ignoresSiblingOrder],
                debugOptions: showsDebugOverlay ? [.showsFPS, .showsNodeCount, .showsDrawCount] : []
            )
            .ignoresSafeArea()

            overlay
        }
        .statusBarHidden()
        .onAppear(perform: setUpIfNeeded)
        .onDisappear { coordinator.exitSession(); bridge?.stop() }
        .onChange(of: coordinator.phase) { _, phase in handlePhaseChange(phase) }
        .onChange(of: coordinator.hudCombo) { old, new in
            if new > old, new > 1 { flareCombo() }
        }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { coordinator.handleBackgrounding() }
        }
    }

    // MARK: - Lifecycle

    private func setUpIfNeeded() {
        guard !didPresent else { return }
        didPresent = true
        scene.configure(exercise: exercise)
        let bridge = HighwayBridge(scene: scene, coordinator: coordinator)
        bridge.start()
        self.bridge = bridge
        coordinator.present(exercise: exercise)
        coordinator.selectMode(.headphones)
        coordinator.calibrationResolved()
    }

    private func handlePhaseChange(_ phase: SessionPhase) {
        switch phase {
        case .ready:
            // A fresh take (initial or post-retry) — clear the once-per-event visual latch.
            bridge?.reset()
            scene.configure(exercise: exercise)
        default:
            break
        }
    }

    private func flareCombo() {
        comboFlare = true
        withAnimation(.spring(response: 0.3, dampingFraction: 0.5)) { comboFlare = false }
    }

    // MARK: - Overlay routing

    @ViewBuilder
    private var overlay: some View {
        switch coordinator.phase {
        case .idle, .modeSelect, .calibrationCheck, .ready:
            setupOverlay
        case let .countdown(beat):
            CountdownOverlay(beat: beat) { coordinator.stopSession() }
        case .playing:
            playingOverlay
        case let .results(stats):
            StageResultsView(
                stats: stats,
                results: coordinator.finalResults,
                isPractice: coordinator.isPracticeMode,
                onRetry: { coordinator.retry() },
                onExit: { coordinator.exitSession() }
            )
        case let .interrupted(reason):
            messageOverlay(
                icon: "exclamationmark.triangle.fill",
                tint: LMMColor.gold,
                title: "Session interrupted (\(String(describing: reason)))",
                primary: ("Retry", { coordinator.retry() })
            )
        case .bluetoothBlocked:
            messageOverlay(
                icon: "airpodspro",
                tint: LMMColor.primary,
                title: "Bluetooth audio adds unpredictable latency and can't be scored accurately.",
                primary: ("Practice anyway (no score)", { Task { await coordinator.acceptPracticeMode() } }),
                secondary: ("Back", { coordinator.dismissBluetoothBlock() })
            )
        }
    }

    // MARK: - Setup

    private var setupOverlay: some View {
        VStack(spacing: LMMSpacing.lg) {
            Spacer()
            VStack(spacing: LMMSpacing.sm) {
                Text(exercise.title)
                    .font(LMMFont.title2).foregroundStyle(.white)
                    .multilineTextAlignment(.center)
                Text(metaLine)
                    .font(LMMFont.caption).foregroundStyle(.white.opacity(0.6))
            }
            if let error = coordinator.errorMessage {
                Text(error).font(LMMFont.caption).foregroundStyle(LMMColor.destructive)
            }
            VStack(spacing: LMMSpacing.xs) {
                Button("Start") { start(offsetMs: 0) }.buttonStyle(.lmmPrimary)
                #if DEBUG
                HStack(spacing: LMMSpacing.xs) {
                    Button("Loose") { start(offsetMs: 55) }.buttonStyle(.lmmSecondary)
                    Button("Miss run") { start(offsetMs: nil) }.buttonStyle(.lmmSecondary)
                }
                Text("DEBUG: synthetic onsets (no mic on Simulator)")
                    .font(.caption2).foregroundStyle(.white.opacity(0.4))
                #endif
            }
            Spacer()
        }
        .padding(LMMSpacing.screen)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black.opacity(0.45))
    }

    private var metaLine: String {
        "\(Int(exercise.bpm)) BPM · \(exercise.timeSignature.numerator)/\(exercise.timeSignature.denominator)"
            + " · \(exercise.events.count) events · \(exercise.difficulty.rawValue)"
    }

    private func start(offsetMs: Double?) {
        #if DEBUG
        coordinator.debugAutoPlayOffsetMs = offsetMs
        #endif
        bridge?.reset()
        Task { await coordinator.startSession() }
    }

    // MARK: - Playing chrome

    private var playingOverlay: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top) {
                hudStat(label: "SCORE", value: String(format: "%.0f", coordinator.hudScore))
                Spacer()
                comboBadge
                Spacer()
                hudStat(label: "ACC", value: String(format: "%.0f%%", coordinator.hudAccuracy))
            }
            .padding(.horizontal, LMMSpacing.lg)
            .padding(.top, LMMSpacing.sm)

            gradeCallout

            Spacer()

            HStack {
                Spacer()
                Button {
                    coordinator.stopSession()
                } label: {
                    Image(systemName: "xmark")
                        .font(.system(size: 15, weight: .bold))
                        .foregroundStyle(.white.opacity(0.85))
                        .frame(width: 40, height: 40)
                        .background(Circle().fill(.black.opacity(0.4)))
                }
                .padding(LMMSpacing.md)
            }
        }
    }

    private func hudStat(label: String, value: String) -> some View {
        VStack(spacing: 2) {
            Text(value)
                .font(.system(size: 26, weight: .light, design: .rounded)).foregroundStyle(.white)
                .monospacedDigit()
            Text(label)
                .font(.system(size: 9, weight: .semibold)).tracking(2).foregroundStyle(.white.opacity(0.5))
        }
    }

    @ViewBuilder
    private var comboBadge: some View {
        if coordinator.hudCombo > 1 {
            Text("×\(coordinator.hudCombo)")
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundStyle(LMMColor.primary)
                .scaleEffect(comboFlare ? 1.25 : 1)
                .shadow(color: LMMColor.primary.opacity(comboFlare ? 0.8 : 0.3), radius: comboFlare ? 16 : 6)
        }
    }

    @ViewBuilder
    private var gradeCallout: some View {
        if let grade = coordinator.hudLastGrade {
            Text(grade.uppercased())
                .font(.system(size: 22, weight: .black, design: .rounded)).tracking(3)
                .foregroundStyle(gradeColor(grade))
                .padding(.top, LMMSpacing.md)
                .id(grade + String(format: "%.1f", coordinator.hudScore))
                .transition(.scale.combined(with: .opacity))
                .animation(.spring(response: 0.3, dampingFraction: 0.6), value: coordinator.hudLastGrade)
        }
    }

    private func gradeColor(_ grade: String) -> Color {
        switch grade {
        case "perfect": return LMMColor.success
        case "good": return LMMColor.gold
        case "ok": return LMMColor.terracotta
        default: return LMMColor.destructive
        }
    }

    // MARK: - Message overlays

    private func messageOverlay(
        icon: String,
        tint: Color,
        title: String,
        primary: (String, () -> Void),
        secondary: (String, () -> Void)? = nil
    ) -> some View {
        VStack(spacing: LMMSpacing.md) {
            Image(systemName: icon).font(.system(size: 36)).foregroundStyle(tint)
            Text(title)
                .font(LMMFont.subheadline).foregroundStyle(.white).multilineTextAlignment(.center)
            Button(primary.0, action: primary.1).buttonStyle(.lmmPrimary)
            if let secondary { Button(secondary.0, action: secondary.1).buttonStyle(.lmmSecondary) }
        }
        .padding(LMMSpacing.xl)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black.opacity(0.6))
    }
}

// MARK: - Sample data

extension StagePlayerView {
    /// A short 2-measure conga groove — the default exercise for the debug entry point / previews.
    public static let sampleExercise: ExerciseDefinition = {
        let events: [ExerciseEvent] = (1...2).flatMap { measure in
            (1...4).map { beat in
                ExerciseEvent(
                    beat: Double(beat), measure: measure, instrument: .conga,
                    technique: .open, hand: beat.isMultiple(of: 2) ? .left : .right,
                    duration: 1, vexKey: "g/4", accent: beat == 1,
                    surface: ["quinto", "conga", "tumba"][(beat - 1) % 3]
                )
            }
        }
        return ExerciseDefinition(
            id: "stage-conga", title: "Conga Groove",
            description: "Two-measure quarter-note groove.",
            instrument: .conga, bpm: 100,
            timeSignature: TimeSignature(numerator: 4, denominator: 4), swing: 0,
            difficulty: .beginner, measures: 2, loopCount: 1, events: events
        )
    }()
}

// MARK: - Countdown overlay

private struct CountdownOverlay: View {
    let beat: Int
    let onCancel: () -> Void
    @State private var pulse = false

    var body: some View {
        VStack(spacing: LMMSpacing.lg) {
            Text("GET READY")
                .font(.system(size: 13, weight: .semibold)).tracking(4).foregroundStyle(.white.opacity(0.6))
            Text(beat > 0 ? "\(beat)" : "•")
                .font(.system(size: 120, weight: .heavy, design: .rounded))
                .foregroundStyle(LMMColor.primary)
                .contentTransition(.numericText())
                .scaleEffect(pulse ? 1.12 : 0.92)
                .shadow(color: LMMColor.primary.opacity(0.5), radius: 24)
                .animation(.spring(response: 0.25, dampingFraction: 0.55), value: beat)
            Button("Cancel", action: onCancel).buttonStyle(.lmmSecondary)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black.opacity(0.35))
        .onChange(of: beat) { _, _ in
            pulse = true
            withAnimation(.easeOut(duration: 0.3)) { pulse = false }
        }
    }
}
