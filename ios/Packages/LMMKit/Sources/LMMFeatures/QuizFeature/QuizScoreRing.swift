import LMMDesignSystem
import SwiftUI

/// A circular score gauge that counts up to `percent` on appear — the web's `ScoreRing`.
struct QuizScoreRing: View {
    let percent: Int
    var size: CGFloat = 156
    var stroke: CGFloat = 13

    @State private var display: Double = 0

    var body: some View {
        ZStack {
            Circle()
                .stroke(LMMColor.border, lineWidth: stroke)
            Circle()
                .trim(from: 0, to: display / 100)
                .stroke(tone, style: StrokeStyle(lineWidth: stroke, lineCap: .round))
                .rotationEffect(.degrees(-90))
            Text("\(Int(display.rounded()))%")
                .font(.system(size: size * 0.24, weight: .black))
                .foregroundStyle(LMMColor.foreground)
        }
        .frame(width: size, height: size)
        .onAppear {
            withAnimation(.easeOut(duration: 0.9)) {
                display = Double(percent)
            }
        }
    }

    private var tone: Color {
        if percent >= 80 { return LMMColor.success }
        if percent >= 50 { return LMMColor.gold }
        return LMMColor.destructive
    }
}
