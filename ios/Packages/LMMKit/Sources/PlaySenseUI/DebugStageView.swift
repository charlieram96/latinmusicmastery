#if DEBUG
import LMMDesignSystem
import PlaySenseCore
import ScoreModel
import SwiftUI

/// DEBUG-only functional stage for D23 — the plain grading UI the D24 SpriteKit highway replaces. It runs a
/// real ``SessionCoordinator`` end-to-end (session config → count-in → grading → results) on a small
/// synthetic conga exercise, driven by synthetic onset injection so a whole session grades deterministically
/// on the Simulator (which has no usable mic). Not pretty — numbers, a timeline, grade flashes.
public struct DebugStageView: View {
    @State private var coordinator = SessionCoordinator()
    @State private var didPresent = false
    @Environment(\.scenePhase) private var scenePhase

    private let exercise: ExerciseDefinition

    public init(exercise: ExerciseDefinition = DebugStageView.sampleExercise) {
        self.exercise = exercise
    }

    public var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: LMMSpacing.lg) {
                content
            }
            .padding(LMMSpacing.screen)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .background(LMMColor.background)
        .navigationTitle("PlaySense Stage (Debug)")
        .onAppear {
            guard !didPresent else { return }
            didPresent = true
            coordinator.present(exercise: exercise)
            coordinator.selectMode(.headphones)
            coordinator.calibrationResolved()
        }
        .onDisappear { coordinator.exitSession() }
        .onChange(of: scenePhase) { _, phase in
            if phase == .background { coordinator.handleBackgrounding() }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch coordinator.phase {
        case .idle, .modeSelect, .calibrationCheck, .ready:
            setup
        case let .countdown(beat):
            countdown(beat: beat)
        case .playing:
            playing
        case let .results(stats):
            results(stats)
        case let .interrupted(reason):
            interrupted(reason)
        case .bluetoothBlocked:
            bluetoothBlocked
        }
    }

    // MARK: - Setup

    private var setup: some View {
        VStack(alignment: .leading, spacing: LMMSpacing.md) {
            Text(exercise.title).font(LMMFont.title2).foregroundStyle(LMMColor.foreground)
            Text(metaLine)
                .font(LMMFont.caption).foregroundStyle(LMMColor.mutedForeground)

            if let error = coordinator.errorMessage {
                Text(error).font(LMMFont.caption).foregroundStyle(LMMColor.destructive)
            }

            Text("Synthetic onsets simulate a player (no mic on Simulator).")
                .font(LMMFont.caption).foregroundStyle(LMMColor.mutedForeground)

            Button("Start — perfect run") { start(offsetMs: 0) }.buttonStyle(.lmmPrimary)
            Button("Start — loose (+55ms)") { start(offsetMs: 55) }.buttonStyle(.lmmSecondary)
            Button("Start — sloppy (mixed)") { start(offsetMs: 95) }.buttonStyle(.lmmSecondary)
            Button("Start — manual tapping") { start(offsetMs: nil) }.buttonStyle(.lmmSecondary)
        }
    }

    private var metaLine: String {
        "\(Int(exercise.bpm)) BPM · \(exercise.timeSignature.numerator)/\(exercise.timeSignature.denominator)"
            + " · \(exercise.events.count) events · \(exercise.difficulty.rawValue)"
    }

    private func start(offsetMs: Double?) {
        coordinator.debugAutoPlayOffsetMs = offsetMs
        Task { await coordinator.startSession() }
    }

    // MARK: - Countdown

    private func countdown(beat: Int) -> some View {
        VStack(spacing: LMMSpacing.md) {
            Text("Get ready").font(LMMFont.headline).foregroundStyle(LMMColor.mutedForeground)
            Text(beat > 0 ? "\(beat)" : "•")
                .font(.system(size: 96, weight: .heavy, design: .rounded))
                .foregroundStyle(LMMColor.primary)
                .contentTransition(.numericText())
                .animation(.snappy, value: beat)
            Button("Cancel") { coordinator.stopSession() }.buttonStyle(.lmmSecondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, LMMSpacing.xl)
    }

    // MARK: - Playing

    private var playing: some View {
        VStack(alignment: .leading, spacing: LMMSpacing.md) {
            hud
            progressBar
            gradeFlash
            timeline
            if coordinator.debugAutoPlayOffsetMs == nil {
                HStack(spacing: LMMSpacing.xs) {
                    Button("Tap") { coordinator.debugTap(offsetMs: 0) }.buttonStyle(.lmmPrimary)
                    Button("Late tap") { coordinator.debugTap(offsetMs: 60) }.buttonStyle(.lmmSecondary)
                }
            }
            Button("Stop") { coordinator.stopSession() }.buttonStyle(.lmmSecondary)
        }
    }

    private var hud: some View {
        HStack {
            stat("Score", String(format: "%.0f", coordinator.hudScore))
            stat("Combo", "\(coordinator.hudCombo)x")
            stat("Acc", String(format: "%.0f%%", coordinator.hudAccuracy))
            if coordinator.isPracticeMode {
                stat("Mode", "PRACTICE")
            }
        }
    }

    private func stat(_ label: String, _ value: String) -> some View {
        VStack(spacing: 2) {
            Text(value).font(.system(.title3, design: .rounded).weight(.bold)).foregroundStyle(LMMColor.foreground)
            Text(label).font(LMMFont.caption).foregroundStyle(LMMColor.mutedForeground)
        }
        .frame(maxWidth: .infinity)
        .padding(LMMSpacing.sm)
        .background(RoundedRectangle(cornerRadius: LMMRadius.md).fill(LMMColor.surface))
    }

    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                RoundedRectangle(cornerRadius: LMMRadius.pill).fill(LMMColor.secondary)
                RoundedRectangle(cornerRadius: LMMRadius.pill)
                    .fill(LMMColor.amberGradient)
                    .frame(width: geo.size.width * coordinator.playheadProgress)
            }
        }
        .frame(height: 10)
    }

    @ViewBuilder
    private var gradeFlash: some View {
        if let grade = coordinator.hudLastGrade {
            Text(grade.uppercased())
                .font(.system(.title2, design: .rounded).weight(.black))
                .foregroundStyle(Self.color(forGrade: grade))
                .contentTransition(.numericText())
                .animation(.snappy, value: grade)
        }
    }

    private var timeline: some View {
        let graded = Dictionary(
            coordinator.hudResults.map { ($0.eventIndex, $0) },
            uniquingKeysWith: { first, _ in first }
        )
        return VStack(alignment: .leading, spacing: LMMSpacing.xxs) {
            Text("Events (\(graded.count)/\(coordinator.expectedEvents.count) graded)")
                .font(LMMFont.caption).foregroundStyle(LMMColor.mutedForeground)
            HStack(spacing: 3) {
                ForEach(coordinator.expectedEvents.prefix(48), id: \.eventIndex) { event in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(gradeColor(graded[event.eventIndex]))
                        .frame(width: 8, height: 18)
                }
            }
        }
    }

    private func gradeColor(_ result: EventResult?) -> Color {
        result.map { Self.color(forGrade: $0.grade.rawValue) } ?? LMMColor.secondary
    }

}

// MARK: - Results / terminal states + sample data

extension DebugStageView {
    private func results(_ stats: AttemptStats) -> some View {
        VStack(alignment: .leading, spacing: LMMSpacing.md) {
            HStack(alignment: .firstTextBaseline, spacing: LMMSpacing.sm) {
                Text(getLetterGrade(stats.score))
                    .font(.system(size: 64, weight: .black, design: .rounded))
                    .foregroundStyle(LMMColor.primary)
                VStack(alignment: .leading) {
                    Text(String(format: "%.0f points", stats.score))
                        .font(LMMFont.headline).foregroundStyle(LMMColor.foreground)
                    Text(String(format: "%.0f%% accuracy", stats.accuracy))
                        .font(LMMFont.subheadline).foregroundStyle(LMMColor.mutedForeground)
                    if coordinator.isPracticeMode {
                        Text("PRACTICE — unranked").font(LMMFont.caption).foregroundStyle(LMMColor.gold)
                    }
                }
            }

            statGrid(stats)

            Text("Per-event")
                .font(LMMFont.caption).foregroundStyle(LMMColor.mutedForeground)
            VStack(spacing: 0) {
                ForEach(coordinator.finalResults, id: \.eventIndex) { result in
                    HStack {
                        Text("#\(result.eventIndex)")
                            .font(.system(.footnote, design: .monospaced)).foregroundStyle(LMMColor.mutedForeground)
                        Spacer()
                        if let offset = result.offsetMs {
                            Text(String(format: "%+.0fms", offset))
                                .font(.system(.footnote, design: .monospaced)).foregroundStyle(LMMColor.mutedForeground)
                        }
                        Text(result.grade.rawValue.uppercased())
                            .font(.system(.footnote, design: .rounded).weight(.bold))
                            .foregroundStyle(Self.color(forGrade: result.grade.rawValue))
                    }
                    .padding(.vertical, 4)
                }
            }

            Button("Retry") { coordinator.retry() }.buttonStyle(.lmmPrimary)
        }
    }

    private func statGrid(_ stats: AttemptStats) -> some View {
        HStack {
            stat("Perfect", "\(stats.perfectCount)")
            stat("Good", "\(stats.goodCount)")
            stat("Ok", "\(stats.okCount)")
            stat("Miss", "\(stats.missCount)")
            stat("Extra", "\(stats.extraHits)")
        }
    }

    // MARK: - Interrupted / blocked

    private func interrupted(_ reason: SessionInterruption) -> some View {
        VStack(spacing: LMMSpacing.md) {
            Image(systemName: "exclamationmark.triangle.fill").font(.system(size: 36)).foregroundStyle(LMMColor.gold)
            Text("Session interrupted (\(String(describing: reason)))")
                .font(LMMFont.headline).foregroundStyle(LMMColor.foreground).multilineTextAlignment(.center)
            Button("Retry") { coordinator.retry() }.buttonStyle(.lmmPrimary)
        }
        .frame(maxWidth: .infinity)
    }

    private var bluetoothBlocked: some View {
        VStack(spacing: LMMSpacing.md) {
            Image(systemName: "airpodspro").font(.system(size: 36)).foregroundStyle(LMMColor.primary)
            Text("Bluetooth audio adds unpredictable latency and can't be scored accurately.")
                .font(LMMFont.subheadline).foregroundStyle(LMMColor.mutedForeground).multilineTextAlignment(.center)
            Button("Practice anyway (no score)") {
                Task { await coordinator.acceptPracticeMode() }
            }
            .buttonStyle(.lmmSecondary)
            Button("Back") { coordinator.dismissBluetoothBlock() }.buttonStyle(.lmmPrimary)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Helpers

    private static func color(forGrade grade: String) -> Color {
        switch grade {
        case "perfect": return LMMColor.success
        case "good": return LMMColor.gold
        case "ok": return LMMColor.terracotta
        default: return LMMColor.destructive
        }
    }

    /// A small 2-measure conga groove — enough events to exercise combo/accuracy without a long session.
    public static let sampleExercise: ExerciseDefinition = {
        let events: [ExerciseEvent] = (1...2).flatMap { measure in
            (1...4).map { beat in
                ExerciseEvent(
                    beat: Double(beat),
                    measure: measure,
                    instrument: .conga,
                    technique: .open,
                    hand: beat.isMultiple(of: 2) ? .left : .right,
                    duration: 1,
                    vexKey: "g/4",
                    accent: beat == 1
                )
            }
        }
        return ExerciseDefinition(
            id: "debug-conga",
            title: "Debug Conga Groove",
            description: "Two-measure quarter-note groove for the D23 stage.",
            instrument: .conga,
            bpm: 100,
            timeSignature: TimeSignature(numerator: 4, denominator: 4),
            swing: 0,
            difficulty: .beginner,
            measures: 2,
            loopCount: 1,
            events: events
        )
    }()
}
#endif
