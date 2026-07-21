import LMMDesignSystem
import PlaySenseBLE
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
    // Not `private`: `StagePlayerView+PlaysenseMode.swift` (a same-module, different-file extension
    // covering the D25 mode-select/BLE-connect overlays — split out purely to stay under SwiftLint's
    // `type_body_length`/`file_length` caps, same reason `CalibrationWizardView`'s `.failure`/`.interrupted`
    // content lives in `CalibrationWizardView+Errors.swift`) needs to reach these.
    @State var coordinator = SessionCoordinator()
    let exercise: ExerciseDefinition
    /// D26: forwarded to `coordinator.attemptSink` in `setUpIfNeeded()`. `nil` (the default) in
    /// every DEBUG harness/preview that doesn't care about persistence — a finished take then
    /// simply stays `.idle`.
    let attemptSink: PlaySenseAttemptSink?
    #if DEBUG
    /// D25 debug-picker demo seam (`Profile → "PlaySense BLE (device picker)"`): bypasses `selectMode`'s
    /// real scan in favor of `SessionCoordinator.debugShowPlaysenseDevicePicker()` (see `choosePlaysenseMode()`
    /// in `StagePlayerView+PlaysenseMode.swift`). Fix round 1 (D25's review, finding 5) moved this — and
    /// `debugForceSyntheticBLE` below — behind `#if DEBUG` via a dual initializer: release builds carry no
    /// inert stored property/init parameter for either, instead of existing but never being read (every
    /// site that reads them was ALREADY `#if DEBUG`-gated).
    let debugForceMultipleDevices: Bool
    #endif

    @State private var scene: HighwayScene
    @State private var bridge: HighwayBridge?
    @State private var didPresent = false
    /// Set once a take actually runs (countdown/playing), so the `.ready` re-configure only fires when the
    /// scene has stale hit/miss state to clear (post-retry) — not on the initial `.idle → .ready`
    /// transition, where `setUpIfNeeded()` already configured the scene and a second `configure` would be
    /// redundant work (rebuilding receptors + regenerating the expected timeline back-to-back).
    @State private var sceneNeedsReconfigure = false
    @State private var comboFlare = false
    @Environment(\.scenePhase) private var scenePhase

    private let showsDebugOverlay: Bool
    /// Which mode to auto-select on appear, bypassing the interactive mode-select screen — matches every
    /// EXISTING call site's behavior exactly (D23/D24 never showed a real mode picker; `selectMode` +
    /// `calibrationResolved` ran synchronously in `setUpIfNeeded`). `nil` shows the real, interactive
    /// `modeSelectOverlay` instead (D25's new debug entry point uses this to exercise/screenshot the
    /// PlaySense option) — additive, so default behavior for headphones/speaker-safe callers is unchanged.
    private let startMode: SessionAudioMode?
    #if DEBUG
    /// D25 Simulator seam: forces `SessionCoordinator.debugSyntheticBLESession` before selecting
    /// `.playsense`, so a synthetic BLE session can be screenshotted (CoreBluetooth has no radio on the
    /// Simulator). See `debugForceMultipleDevices` above for why this moved behind `#if DEBUG` in fix
    /// round 1 (an earlier revision deliberately kept it release-visible to avoid parameter-list
    /// conditional-compilation branching — the review called that inert-in-release surface out instead).
    private let debugForceSyntheticBLE: Bool
    #endif

    #if DEBUG
    public init(
        exercise: ExerciseDefinition = StagePlayerView.sampleExercise,
        showsDebugOverlay: Bool = false,
        startMode: SessionAudioMode? = .headphones,
        attemptSink: PlaySenseAttemptSink? = nil,
        debugForceSyntheticBLE: Bool = false,
        debugForceMultipleDevices: Bool = false
    ) {
        self.exercise = exercise
        self.showsDebugOverlay = showsDebugOverlay
        self.startMode = startMode
        self.attemptSink = attemptSink
        self.debugForceSyntheticBLE = debugForceSyntheticBLE
        self.debugForceMultipleDevices = debugForceMultipleDevices
        _scene = State(initialValue: HighwayScene(size: CGSize(width: 402, height: 874)))
    }
    #else
    public init(
        exercise: ExerciseDefinition = StagePlayerView.sampleExercise,
        showsDebugOverlay: Bool = false,
        startMode: SessionAudioMode? = .headphones,
        attemptSink: PlaySenseAttemptSink? = nil
    ) {
        self.exercise = exercise
        self.showsDebugOverlay = showsDebugOverlay
        self.startMode = startMode
        self.attemptSink = attemptSink
        _scene = State(initialValue: HighwayScene(size: CGSize(width: 402, height: 874)))
    }
    #endif

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
            if phase == .background {
                coordinator.handleBackgrounding()
            } else if phase == .active {
                coordinator.handleForegrounding()
            }
        }
    }

    // MARK: - Lifecycle

    private func setUpIfNeeded() {
        guard !didPresent else { return }
        didPresent = true
        coordinator.attemptSink = attemptSink
        scene.configure(exercise: exercise)
        let bridge = HighwayBridge(scene: scene, coordinator: coordinator)
        bridge.start()
        self.bridge = bridge
        coordinator.present(exercise: exercise)

        #if DEBUG
        if debugForceSyntheticBLE { coordinator.debugSyntheticBLESession = true }
        #endif

        if let startMode {
            #if DEBUG
            if startMode == .playsense, debugForceMultipleDevices {
                // The multi-device-picker demo entry point auto-selecting `.playsense` needs the SAME
                // bypass `choosePlaysenseMode()` uses from the interactive mode-select screen — otherwise
                // `selectMode(.playsense)` would kick off a real (inert-on-Simulator) scan instead.
                coordinator.debugShowPlaysenseDevicePicker()
            } else {
                coordinator.selectMode(startMode)
            }
            #else
            coordinator.selectMode(startMode)
            #endif
            if startMode != .playsense { coordinator.calibrationResolved() }
        }
        // else: stay at `.modeSelect` — `modeSelectOverlay` lets the player choose, including PlaySense.

        #if DEBUG
        // The synthetic-BLE demo entry point (Profile → "PlaySense BLE (synthetic session)") has no other
        // way to reach a live graded take without a real device — `beginBLEModeSelect`'s synthetic bypass
        // above resolves synchronously to `.ready`, so auto-starting here gives a deterministic,
        // no-interaction screenshot target for the whole BLE grading pipeline.
        if debugForceSyntheticBLE, case .ready = coordinator.phase {
            start(offsetMs: 0)
        }
        #endif
    }

    private func handlePhaseChange(_ phase: SessionPhase) {
        switch phase {
        case .countdown, .playing:
            sceneNeedsReconfigure = true
        case .ready:
            // A fresh take (initial or post-retry) — clear the once-per-event visual latch.
            bridge?.reset()
            // Only re-configure when a previous take left stale hit/miss state on the scene; the initial
            // `.idle → .ready` arrives right after `setUpIfNeeded()`'s configure (see `sceneNeedsReconfigure`).
            if sceneNeedsReconfigure {
                sceneNeedsReconfigure = false
                scene.configure(exercise: exercise)
            }
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
        case .idle, .calibrationCheck, .ready:
            setupOverlay
        case .modeSelect:
            modeSelectOverlay
        case .connectingDevice:
            connectingDeviceOverlay
        case let .countdown(beat):
            CountdownOverlay(beat: beat) { coordinator.stopSession() }
        case .playing:
            playingOverlay
        case let .results(stats):
            StageResultsView(
                stats: stats,
                results: coordinator.finalResults,
                isPractice: coordinator.isPracticeMode,
                persistState: coordinator.attemptPersistState,
                onRetry: { coordinator.retry() },
                onExit: { coordinator.exitSession() }
            )
        case let .interrupted(reason):
            messageOverlay(
                icon: "exclamationmark.triangle.fill",
                tint: LMMColor.gold,
                title: lmmFormat("stage.interruptedTitleFormat", String(describing: reason)),
                primary: (lmmString("common.retry"), { coordinator.retry() })
            )
        case .bluetoothBlocked:
            messageOverlay(
                icon: "airpodspro",
                tint: LMMColor.primary,
                title: lmmString("stage.bluetoothBlocked.title"),
                primary: (
                    lmmString("stage.bluetoothBlocked.practiceAnyway"),
                    { Task { await coordinator.acceptPracticeMode() } }
                ),
                secondary: (lmmString("common.back"), { coordinator.dismissBluetoothBlock() })
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
                Button(lmmString("stage.start")) { start(offsetMs: 0) }.buttonStyle(.lmmPrimary)
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
        lmmFormat(
            "stage.meta.format",
            Int(exercise.bpm),
            exercise.timeSignature.numerator,
            exercise.timeSignature.denominator,
            exercise.events.count,
            exercise.difficulty.rawValue
        )
    }

    // MARK: - Mode select / connecting device (D25) — see `StagePlayerView+PlaysenseMode.swift`

    private func start(offsetMs: Double?) {
        #if DEBUG
        // PlaySense mode's synthetic evidence goes through `debugSyntheticBLESession`/`BLEOnsetSource`
        // instead (set once, in `setUpIfNeeded`/`modeSelectOverlay`) — setting BOTH seams at once would
        // double-inject every event (once here via the mic seam's direct `scorer.ingest`, once via the
        // real BLE mapping pipeline).
        if coordinator.audioMode != .playsense {
            coordinator.debugAutoPlayOffsetMs = offsetMs
        }
        #endif
        bridge?.reset()
        Task { await coordinator.startSession() }
    }

    // MARK: - Playing chrome

    private var playingOverlay: some View {
        StagePlayingChrome(
            score: coordinator.hudScore,
            combo: coordinator.hudCombo,
            accuracy: coordinator.hudAccuracy,
            lastGrade: coordinator.hudLastGrade,
            comboFlare: comboFlare,
            onQuit: { coordinator.stopSession() }
        )
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

// `StagePlayingChrome`/`CountdownOverlay` live in `StageChrome.swift` (split out to stay under
// SwiftLint's `file_length` cap).
