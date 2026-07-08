import NotationEngraving
import UIKit

/// One system's backing layer. Draws its `SystemFrame` band ONCE — via the pure
/// `drawSystem(_:in:contentHeight:notationColor:)` CG path rendered into a `CGImage` set as the
/// layer's `contents` — and can release that image (`contents = nil`) when the system scrolls
/// out of the view's window, re-rendering on demand when it scrolls back in.
///
/// `contents` is used (rather than overriding `draw(in:)`) so the proven, top-left/y-down
/// `UIGraphicsImageRenderer` context feeds `drawMeasureFrame` exactly as the snapshot tests do —
/// sidestepping the coordinate-flip fragility of a bare `CALayer.draw(in:)` context. Behavior
/// (draw once, release outside the window, redraw on demand) is identical.
final class SystemTileLayer: CALayer {
    let system: SystemFrame
    private let contentHeight: CGFloat
    /// The ink color the current `contents` were rendered with (`nil` once released) — lets a
    /// visibility pass skip re-rendering an already-drawn tile whose color hasn't changed.
    private var renderedColor: NotationColor?

    init(system: SystemFrame, contentHeight: CGFloat) {
        self.system = system
        self.contentHeight = contentHeight
        super.init()
        isOpaque = false
        needsDisplayOnBoundsChange = false
    }

    /// CALayer's presentation/animation copy initializer — copies the stored state across.
    override init(layer: Any) {
        if let tile = layer as? SystemTileLayer {
            self.system = tile.system
            self.contentHeight = tile.contentHeight
            self.renderedColor = tile.renderedColor
        } else {
            self.system = SystemFrame(
                index: 0, topLineY: 0, originX: 0, width: 0, staffSpace: 1, frame: .zero, measures: []
            )
            self.contentHeight = 0
        }
        super.init(layer: layer)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    /// Render only if not already drawn in `color`.
    func renderIfNeeded(color: NotationColor) {
        guard contents == nil || renderedColor != color else { return }
        forceRender(color: color)
    }

    /// Render the system band into `contents`, unconditionally.
    func forceRender(color: NotationColor) {
        let size = system.frame.size
        guard size.width > 0, size.height > 0 else { return }
        let format = UIGraphicsImageRendererFormat.preferred()
        format.opaque = false
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let image = renderer.image { ctx in
            drawSystem(system, in: ctx.cgContext, contentHeight: contentHeight, notationColor: color)
        }
        contents = image.cgImage
        renderedColor = color
    }

    /// Drop the drawn image (windowed out of view).
    func releaseContents() {
        guard contents != nil else { return }
        contents = nil
        renderedColor = nil
    }
}
