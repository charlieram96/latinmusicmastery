import SwiftUI

/// A circular progress indicator filled with the signature amber gradient. Used on the
/// course-detail hero to show "X of Y complete".
public struct ProgressRing: View {
    private let progress: Double
    private let lineWidth: CGFloat
    private let label: String?

    /// - Parameters:
    ///   - progress: 0...1.
    ///   - lineWidth: stroke thickness.
    ///   - label: optional centered text (e.g. "40%").
    public init(progress: Double, lineWidth: CGFloat = 8, label: String? = nil) {
        self.progress = min(max(progress, 0), 1)
        self.lineWidth = lineWidth
        self.label = label
    }

    public var body: some View {
        ZStack {
            Circle()
                .stroke(LMMColor.secondary, lineWidth: lineWidth)
            Circle()
                .trim(from: 0, to: progress)
                .stroke(
                    LMMColor.amberGradient,
                    style: StrokeStyle(lineWidth: lineWidth, lineCap: .round)
                )
                .rotationEffect(.degrees(-90))
            if let label {
                Text(label)
                    .font(LMMFont.headline)
                    .foregroundStyle(LMMColor.foreground)
                    .monospacedDigit()
            }
        }
        .accessibilityElement()
        .accessibilityValue(Text("\(Int(progress * 100)) percent"))
    }
}

/// A slim linear progress bar with the amber gradient fill. Used on course cards and the
/// My Courses list.
public struct ProgressBar: View {
    private let progress: Double
    private let height: CGFloat

    public init(progress: Double, height: CGFloat = 6) {
        self.progress = min(max(progress, 0), 1)
        self.height = height
    }

    public var body: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule().fill(LMMColor.secondary)
                Capsule()
                    .fill(LMMColor.amberGradient)
                    .frame(width: max(height, geo.size.width * progress))
            }
        }
        .frame(height: height)
        .accessibilityElement()
        .accessibilityValue(Text("\(Int(progress * 100)) percent"))
    }
}

#Preview {
    VStack(spacing: 24) {
        ProgressRing(progress: 0.4, lineWidth: 10, label: "40%")
            .frame(width: 88, height: 88)
        ProgressBar(progress: 0.65)
    }
    .padding()
    .background(LMMColor.background)
}
