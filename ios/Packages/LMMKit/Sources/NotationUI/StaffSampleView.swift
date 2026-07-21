import NotationEngraving
import SwiftUI

/// Debug-only view rendering `drawStaffSample` — the task C13 proof that Bravura font
/// loading, `GlyphMetrics`, and `StaffGeometry` compose correctly end to end. Not wired into
/// any user-facing navigation; it exists for the `#Preview`s below and ad-hoc visual checks
/// while later tasks (measure layout, beaming, ...) build on top of NotationEngraving.
struct StaffSampleView: View {
    var staffSpacePoints: CGFloat = 12

    @Environment(\.colorScheme) private var colorScheme

    var body: some View {
        GeometryReader { proxy in
            Image(uiImage: renderedImage(size: proxy.size))
                .resizable()
        }
        .frame(height: staffSpacePoints * 12)
    }

    private func renderedImage(size: CGSize) -> UIImage {
        let scale = ScaleContext(staffSpacePoints: staffSpacePoints)
        let notationColor: NotationColor = colorScheme == .dark ? .darkDefault : .lightDefault
        let backgroundColor: CGColor = colorScheme == .dark ? .init(gray: 0, alpha: 1) : .init(gray: 1, alpha: 1)

        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { rendererContext in
            let ctx = rendererContext.cgContext
            ctx.setFillColor(backgroundColor)
            ctx.fill(CGRect(origin: .zero, size: size))
            drawStaffSample(in: ctx, size: size, scale: scale, notationColor: notationColor)
        }
    }
}

#Preview("Staff sample — small") {
    StaffSampleView(staffSpacePoints: 8)
        .padding()
}

#Preview("Staff sample — large") {
    StaffSampleView(staffSpacePoints: 16)
        .padding()
}

#Preview("Staff sample — dark") {
    StaffSampleView(staffSpacePoints: 12)
        .padding()
        .background(Color.black)
        .preferredColorScheme(.dark)
}
