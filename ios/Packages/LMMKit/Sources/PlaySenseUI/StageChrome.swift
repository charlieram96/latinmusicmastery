import LMMDesignSystem
import SwiftUI

// `StagePlayingChrome`/`CountdownOverlay` — value-driven SwiftUI chrome shared by the live `StagePlayerView`
// and (D24) the deterministic screenshot harness. Split out of `StagePlayerView.swift` purely to keep that
// file under SwiftLint's `file_length` cap (D25 added the mode-select/BLE-connect overlays there) — same
// reason `CalibrationWizardView`'s `.failure`/`.interrupted` content lives in its own file. No behavioral
// significance.

// MARK: - Playing chrome

/// The in-play HUD overlay (score / combo / accuracy, grade callout, quit) — a standalone view over
/// the highway so it can be driven from plain values (the live stage, and the screenshot harness).
struct StagePlayingChrome: View {
    let score: Double
    let combo: Int
    let accuracy: Double
    let lastGrade: String?
    let comboFlare: Bool
    let onQuit: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(alignment: .top) {
                stat(label: "SCORE", value: String(format: "%.0f", score))
                Spacer()
                comboBadge
                Spacer()
                stat(label: "ACC", value: String(format: "%.0f%%", accuracy))
            }
            .padding(.horizontal, LMMSpacing.lg)
            .padding(.top, LMMSpacing.sm)

            gradeCallout
            Spacer()

            HStack {
                Spacer()
                Button(action: onQuit) {
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

    private func stat(label: String, value: String) -> some View {
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
        if combo > 1 {
            Text("×\(combo)")
                .font(.system(size: 30, weight: .heavy, design: .rounded))
                .foregroundStyle(LMMColor.primary)
                .scaleEffect(comboFlare ? 1.25 : 1)
                .shadow(color: LMMColor.primary.opacity(comboFlare ? 0.8 : 0.3), radius: comboFlare ? 16 : 6)
        }
    }

    @ViewBuilder
    private var gradeCallout: some View {
        if let grade = lastGrade {
            Text(grade.uppercased())
                .font(.system(size: 22, weight: .black, design: .rounded)).tracking(3)
                .foregroundStyle(Self.gradeColor(grade))
                .padding(.top, LMMSpacing.md)
        }
    }

    static func gradeColor(_ grade: String) -> Color {
        switch grade {
        case "perfect": return LMMColor.success
        case "good": return LMMColor.gold
        case "ok": return LMMColor.terracotta
        default: return LMMColor.destructive
        }
    }
}

// MARK: - Countdown overlay

struct CountdownOverlay: View {
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
