import NotationEngraving
import UIKit

/// One column tile of a system's backing layer. A tile covers a GLOBAL-coordinate rectangle
/// (`column`) — a horizontal sub-strip of its `system`'s band — and draws just that strip ONCE,
/// via the pure `drawSystem(_:in:contentHeight:column:notationColor:)` CG path rendered into a
/// `CGImage` set as the layer's `contents`. It releases that image (`contents = nil`) when it
/// scrolls out of the view's window and re-renders on demand when it scrolls back in.
///
/// In wrapped mode a system is a single tile spanning its (one-screen-wide) band. In scroll mode
/// the one wide strip is split into several fixed-width column tiles so no single bitmap exceeds
/// the CGImage/Metal 8192 px texture limit (a 40-bar strip at zoom is > 16k px wide).
///
/// `contents` is used (rather than overriding `draw(in:)`) so the proven, top-left/y-down
/// `UIGraphicsImageRenderer` context feeds `drawMeasureFrame` exactly as the snapshot tests do —
/// sidestepping the coordinate-flip fragility of a bare `CALayer.draw(in:)` context.
final class SystemTileLayer: CALayer {
    let system: SystemFrame
    /// The global-coordinate rectangle this tile renders (and its layer `frame`).
    let column: CGRect
    private let contentHeight: CGFloat
    /// The ink color the current `contents` were rendered with (`nil` once released) — lets a
    /// visibility pass skip re-rendering an already-drawn tile whose color hasn't changed.
    private var renderedColor: NotationColor?

    init(system: SystemFrame, column: CGRect, contentHeight: CGFloat) {
        self.system = system
        self.column = column
        self.contentHeight = contentHeight
        super.init()
        isOpaque = false
        needsDisplayOnBoundsChange = false
    }

    /// CALayer's presentation/animation copy initializer — copies the stored state across.
    override init(layer: Any) {
        if let tile = layer as? SystemTileLayer {
            self.system = tile.system
            self.column = tile.column
            self.contentHeight = tile.contentHeight
            self.renderedColor = tile.renderedColor
        } else {
            self.system = SystemFrame(
                index: 0, topLineY: 0, originX: 0, width: 0, staffSpace: 1, frame: .zero, measures: []
            )
            self.column = .zero
            self.contentHeight = 0
        }
        super.init(layer: layer)
    }

    required init?(coder: NSCoder) {
        fatalError("init(coder:) has not been implemented")
    }

    /// The tile's rendered bitmap size in device pixels at `scale` — the texture-limit test seam.
    func pixelSize(scale: CGFloat) -> CGSize {
        CGSize(width: column.width * scale, height: column.height * scale)
    }

    /// Render only if not already drawn in `color`.
    func renderIfNeeded(color: NotationColor) {
        guard contents == nil || renderedColor != color else { return }
        forceRender(color: color)
    }

    /// Render the tile's column band into `contents`, unconditionally.
    func forceRender(color: NotationColor) {
        let size = column.size
        guard size.width > 0, size.height > 0 else { return }
        let format = UIGraphicsImageRendererFormat.preferred()
        format.opaque = false
        let renderer = UIGraphicsImageRenderer(size: size, format: format)
        let image = renderer.image { ctx in
            drawSystem(system, in: ctx.cgContext, contentHeight: contentHeight, column: column, notationColor: color)
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
