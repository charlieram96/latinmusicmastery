import LMMDesignSystem
import PlaySenseCore
import SwiftUI

/// The post-take results panel for ``StagePlayerView`` — a design-system card over the dimmed
/// highway: grade letter, score + accuracy, the perfect/good/ok/miss/extra grid, a per-event grade
/// strip, and Retry / Exit. Styling cues from the web `stage-results.tsx`, tokens from A5.
struct StageResultsView: View {
    let stats: AttemptStats
    let results: [EventResult]
    let isPractice: Bool
    let onRetry: () -> Void
    let onExit: () -> Void

    var body: some View {
        VStack {
            Spacer(minLength: LMMSpacing.xl)
            VStack(alignment: .leading, spacing: LMMSpacing.lg) {
                header
                statGrid
                perEventStrip
                HStack(spacing: LMMSpacing.sm) {
                    Button("Exit", action: onExit).buttonStyle(.lmmSecondary)
                    Button("Retry", action: onRetry).buttonStyle(.lmmPrimary)
                }
            }
            .padding(LMMSpacing.lg)
            .background(
                RoundedRectangle(cornerRadius: LMMRadius.xl, style: .continuous)
                    .fill(LMMColor.surface)
                    .overlay(
                        RoundedRectangle(cornerRadius: LMMRadius.xl, style: .continuous)
                            .strokeBorder(LMMColor.border, lineWidth: 1)
                    )
            )
            .padding(LMMSpacing.md)
            Spacer(minLength: LMMSpacing.xl)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.black.opacity(0.6))
    }

    private var header: some View {
        HStack(alignment: .center, spacing: LMMSpacing.md) {
            ZStack {
                Circle().fill(LMMColor.warmGradient).frame(width: 92, height: 92)
                Text(getLetterGrade(stats.score))
                    .font(.system(size: 44, weight: .black, design: .rounded))
                    .foregroundStyle(.white)
            }
            VStack(alignment: .leading, spacing: 2) {
                Text(String(format: "%.0f", stats.score))
                    .font(.system(size: 34, weight: .bold, design: .rounded))
                    .foregroundStyle(LMMColor.foreground)
                Text(String(format: "%.0f%% accuracy", stats.accuracy))
                    .font(LMMFont.subheadline).foregroundStyle(LMMColor.mutedForeground)
                if isPractice {
                    Text("PRACTICE — unranked")
                        .font(.caption2).tracking(1).foregroundStyle(LMMColor.gold)
                }
            }
            Spacer()
        }
    }

    private var statGrid: some View {
        HStack(spacing: LMMSpacing.xs) {
            statCell("PERFECT", stats.perfectCount, LMMColor.success)
            statCell("GOOD", stats.goodCount, LMMColor.gold)
            statCell("OK", stats.okCount, LMMColor.terracotta)
            statCell("MISS", stats.missCount, LMMColor.destructive)
            statCell("MAX ×", stats.maxCombo, LMMColor.primary)
        }
    }

    private func statCell(_ label: String, _ value: Int, _ tint: Color) -> some View {
        VStack(spacing: 3) {
            Text("\(value)")
                .font(.system(.title3, design: .rounded).weight(.bold)).foregroundStyle(tint)
            Text(label)
                .font(.system(size: 8, weight: .semibold)).tracking(1).foregroundStyle(LMMColor.mutedForeground)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, LMMSpacing.sm)
        .background(RoundedRectangle(cornerRadius: LMMRadius.md).fill(LMMColor.surfaceSunken))
    }

    private var perEventStrip: some View {
        VStack(alignment: .leading, spacing: LMMSpacing.xs) {
            Text("PER-EVENT")
                .font(.system(size: 10, weight: .semibold)).tracking(2).foregroundStyle(LMMColor.mutedForeground)
            // Capped to a card-width run of bars (mirrors DebugStageView's strip).
            HStack(spacing: 3) {
                ForEach(results.prefix(32), id: \.eventIndex) { result in
                    RoundedRectangle(cornerRadius: 2)
                        .fill(color(for: result.grade))
                        .frame(maxWidth: .infinity)
                        .frame(height: 22)
                }
            }
        }
    }

    private func color(for grade: HitGrade) -> Color {
        switch grade {
        case .perfect: return LMMColor.success
        case .good: return LMMColor.gold
        case .ok: return LMMColor.terracotta
        case .miss: return LMMColor.destructive
        }
    }
}
