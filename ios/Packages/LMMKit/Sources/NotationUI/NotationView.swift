import NotationEngraving
import ScoreModel
import UIKit

/// A performant, native full-score notation view.
///
/// Wraps a `UIScrollView` whose content hosts one `SystemTileLayer` per system. Each system is
/// drawn ONCE (into its layer's `contents`, via the pure `SystemLayout` + `drawSystem` CG path);
/// layers outside the visible rect plus a one-screen buffer release their `contents` and are
/// re-drawn on demand as they scroll back in. Pinch maps to the `ZOOM_MIN…ZOOM_MAX` range and
/// re-lays-out at the new scale (debounced); a trait (light/dark) change re-renders the drawn
/// tiles' ink without re-laying-out; a wrapped-mode width change reflows (debounced).
///
/// A ``CursorGeometry``-driven playhead (C18) rides above the tiles: `setCursorTime(scoreMs:)`
/// positions it per video frame (transform/frame-only, no re-render), auto-follow scrolls the
/// active row/strip into view, and a tap hit-tests `noteAnchors` for tap-to-seek (`onSeekQN`).
public final class NotationView: UIView {
    // MARK: Zoom bounds (ported from staff-renderer.tsx)

    public static let zoomMin: CGFloat = 0.5
    public static let zoomMax: CGFloat = 2.6

    /// Points per staff space at zoom 1. The whole staff scales off this single knob; the web's
    /// 10 model-px/space × BASE_SCALE 1.3 ≈ 13 rendered px is the reference — 10 keeps a 4/4 bar
    /// (~360 pt) filling a phone row while an iPad packs two.
    public var baseStaffSpacePoints: CGFloat = 10 { didSet { relayout() } }

    // MARK: State

    // `scrollView`/`contentView` are module-internal (not `private`) so the C18 cursor extension
    // in `NotationView+Cursor.swift` can drive the scroll offset and host the playhead layers.
    let scrollView = UIScrollView()
    let contentView = UIView()
    private var tiles: [SystemTileLayer] = []

    private var score: ScoreDocument?
    private var track: Track?
    private var measures: [MeasureDescriptor] = []
    private(set) var mode: StaffLayoutMode = .wrapped
    private(set) var zoom: CGFloat = 1

    private(set) var scoreLayout: ScoreLayout?
    private var lastLayoutWidth: CGFloat = 0
    private var reflowWorkItem: DispatchWorkItem?
    private var pinchStartZoom: CGFloat = 1

    // MARK: Cursor / video-sync state (C18)

    // These back the C18 cursor extension (`NotationView+Cursor.swift`) so they are module-internal
    // rather than `private`.
    /// Fraction of the viewport width the playhead anchors at in scroll mode (port of the web's
    /// `CURSOR_ANCHOR_FRACTION`).
    static let cursorAnchorFraction: CGFloat = 0.08
    /// The playhead line + current-measure glow — transform/frame-only updates (no re-render).
    let cursorLine = CALayer()
    let measureHighlight = CALayer()
    var cursorGeometry: CursorGeometry?
    var cursorScoreMs: Double = 0
    var cursorIsVisible = false
    /// Last system the auto-scroll settled on, so a wrapped row jump only fires on change.
    var lastFollowedSystem = -1
    var followController = AutoFollowController()

    /// Tap-to-seek callback carrying the tapped position in quarter notes (the driver maps it to
    /// video time and seeks). Set by the sync layer.
    public var onSeekQN: ((Double) -> Void)?
    /// The zoom the current tiles were laid out at — the reference for the transient pinch scale
    /// applied to `contentView` before a re-layout snaps in.
    private var renderedZoom: CGFloat = 1

    /// A tile's bitmap must stay well under the CGImage/Metal 8192 px per-axis texture limit; we
    /// cap each column tile at this many device pixels wide, giving ample headroom.
    private static let maxTilePixelWidth: CGFloat = 4096

    /// Ink color for the current trait collection.
    private var notationColor: NotationColor {
        traitCollection.userInterfaceStyle == .dark ? .darkDefault : .lightDefault
    }

    // MARK: Init

    public override init(frame: CGRect) {
        super.init(frame: frame)
        setUp()
    }

    public required init?(coder: NSCoder) {
        super.init(coder: coder)
        setUp()
    }

    private func setUp() {
        backgroundColor = .systemBackground
        scrollView.backgroundColor = .clear
        scrollView.delegate = self
        scrollView.showsVerticalScrollIndicator = true
        scrollView.showsHorizontalScrollIndicator = mode == .scroll
        scrollView.contentInsetAdjustmentBehavior = .never
        scrollView.frame = bounds
        scrollView.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        addSubview(scrollView)
        scrollView.addSubview(contentView)

        let pinch = UIPinchGestureRecognizer(target: self, action: #selector(handlePinch(_:)))
        addGestureRecognizer(pinch)

        // Tap-to-seek: coexists with the scroll pan / pinch (a discrete tap never starts a scroll).
        let tap = UITapGestureRecognizer(target: self, action: #selector(handleTap(_:)))
        scrollView.addGestureRecognizer(tap)

        setUpCursorLayers()

        // Ink color follows light/dark — re-render the drawn tiles when the style flips (no
        // relayout, geometry is unchanged). iOS 17 trait-change registration (not the deprecated
        // `traitCollectionDidChange`).
        registerForTraitChanges([UITraitUserInterfaceStyle.self]) { (view: NotationView, _: UITraitCollection) in
            let color = view.notationColor
            for tile in view.tiles where tile.contents != nil {
                tile.forceRender(color: color)
            }
        }
    }

    // MARK: Public API

    /// Load a track of a score for display in `mode`. Rebuilds the layout + tiles.
    public func load(score: ScoreDocument, trackIndex: Int, mode: StaffLayoutMode) {
        self.score = score
        self.track = trackIndex < score.tracks.count ? score.tracks[trackIndex] : score.tracks.first
        self.mode = mode
        self.measures = track.map {
            EventDescriptorBuilder.extractTrackEvents(
                track: $0, initialTimeSignature: score.initialTimeSignature, keyFifths: score.initialKeyFifths
            )
        } ?? []
        scrollView.showsHorizontalScrollIndicator = mode == .scroll
        // A fresh score/section starts following again (nothing carries over from the last one).
        followController.reset()
        lastFollowedSystem = -1
        relayout()
    }

    /// Forwards to the scroll view — the seam the C18 auto-scroll / seek will drive.
    public func setContentOffset(_ offset: CGPoint, animated: Bool) {
        scrollView.setContentOffset(offset, animated: animated)
    }

    /// The current user zoom (1 = base scale).
    public var currentZoom: CGFloat { zoom }

    // MARK: Layout

    public override func layoutSubviews() {
        super.layoutSubviews()
        let width = bounds.width
        guard width > 0 else { return }
        if scoreLayout == nil {
            relayout()
        } else if mode == .wrapped, abs(width - lastLayoutWidth) > 1 {
            // Wrapped reflow depends on width — debounce so a live resize settles before rebuild.
            scheduleReflow()
        }
        updateVisibleSystems()
    }

    private func scheduleReflow() {
        reflowWorkItem?.cancel()
        let work = DispatchWorkItem { [weak self] in self?.relayout() }
        reflowWorkItem = work
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15, execute: work)
    }

    private func relayout() {
        reflowWorkItem?.cancel()
        // Any transient pinch scale is superseded by the fresh layout.
        contentView.layer.transform = CATransform3DIdentity
        renderedZoom = zoom
        let width = bounds.width
        guard width > 0, !measures.isEmpty, let track, let score else {
            tiles.forEach { $0.removeFromSuperlayer() }
            tiles = []
            scoreLayout = nil
            cursorGeometry = nil
            applyCursor(animated: false)
            return
        }
        lastLayoutWidth = width
        let scale = ScaleContext(staffSpacePoints: baseStaffSpacePoints * zoom)
        let layout = SystemLayout.layout(
            measures: measures, availableWidth: width, mode: mode, scale: scale,
            startMsForQN: { ScoreTime.qnToTrackMs(track: track, score: score, qn: $0) }
        )
        scoreLayout = layout
        rebuildTiles(for: layout)
        rebuildCursorGeometry(for: layout, track: track, score: score)
        updateVisibleSystems()
    }

    private func rebuildTiles(for layout: ScoreLayout) {
        tiles.forEach { $0.removeFromSuperlayer() }
        contentView.frame = CGRect(origin: .zero, size: layout.totalSize)
        scrollView.contentSize = layout.totalSize
        let displayScale = currentDisplayScale
        let maxTilePoints = maxTilePointWidth(displayScale: displayScale)
        tiles = layout.systems.flatMap { system -> [SystemTileLayer] in
            columnRects(for: system, maxWidth: maxTilePoints, displayScale: displayScale).map { column in
                let tile = SystemTileLayer(system: system, column: column, contentHeight: layout.totalSize.height)
                tile.frame = column
                tile.contentsScale = displayScale
                contentView.layer.addSublayer(tile)
                return tile
            }
        }
    }

    private var currentDisplayScale: CGFloat {
        traitCollection.displayScale > 0 ? traitCollection.displayScale : 2
    }

    /// The maximum tile width in POINTS such that the rendered bitmap stays under the texture
    /// limit at `displayScale`: `points × scale ≤ maxTilePixelWidth (4096) < 8192`. Also capped at
    /// ~two screen widths so a tile is never needlessly larger than the visible window. A system
    /// narrower than this (every wrapped system, a short scroll strip) yields a single tile.
    private func maxTilePointWidth(displayScale: CGFloat) -> CGFloat {
        let byTexture = Self.maxTilePixelWidth / max(displayScale, 1)
        let byScreen = max(bounds.width, 1) * 2
        return max(min(byTexture, byScreen), 1)
    }

    /// Split a system's band into fixed-width column tiles (each ≤ `maxWidth` points). Wide scroll
    /// strips fan out into several; a within-limit system stays a single full-band tile.
    ///
    /// Column boundaries are snapped to the device-pixel grid (multiples of `1/displayScale`): the
    /// step advanced between tiles is floored to a whole number of device pixels, so — because a
    /// scroll band starts at x = 0 (itself on the grid) — every interior boundary lands exactly on
    /// a pixel edge. A fractional-pixel boundary would split a device pixel between two tiles and
    /// leave a faint anti-aliased seam where they meet; snapping eliminates it.
    private func columnRects(for system: SystemFrame, maxWidth: CGFloat, displayScale: CGFloat) -> [CGRect] {
        let band = system.frame
        guard band.width > maxWidth else { return [band] }
        let pixel = 1 / max(displayScale, 1)
        let step = max((maxWidth / pixel).rounded(.down) * pixel, pixel)
        var rects: [CGRect] = []
        var cursorX = band.minX
        while cursorX < band.maxX {
            let tileWidth = min(step, band.maxX - cursorX)
            rects.append(CGRect(x: cursorX, y: band.minY, width: tileWidth, height: band.height))
            cursorX += step
        }
        return rects
    }

    // MARK: Windowing (draw once; release outside visible rect + 1 screen)

    /// System indices whose tile currently holds drawn `contents` — the test seam for windowing.
    var renderedSystemIndices: Set<Int> {
        Set(tiles.filter { $0.contents != nil }.map(\.system.index))
    }

    /// All column tiles' global rectangles — the tiling test seam.
    var tileColumns: [CGRect] { tiles.map(\.column) }

    /// Column rectangles of tiles currently holding drawn `contents` — the windowing test seam.
    var renderedTileColumns: [CGRect] { tiles.filter { $0.contents != nil }.map(\.column) }

    /// Every tile's bitmap size in device pixels — asserts the texture-limit bound in tests.
    var tilePixelSizes: [CGSize] { tiles.map { $0.pixelSize(scale: currentDisplayScale) } }

    /// Re-evaluate which column tiles should be drawn: any intersecting the visible rect expanded
    /// by one screen in BOTH axes is rendered; the rest release their `contents`. The horizontal
    /// expansion windows the scroll strip's column tiles the same way the vertical one windows
    /// wrapped systems.
    func updateVisibleSystems() {
        guard !tiles.isEmpty else { return }
        let visible = CGRect(origin: scrollView.contentOffset, size: scrollView.bounds.size)
        let window = visible.insetBy(dx: -visible.width, dy: -visible.height)
        let color = notationColor
        for tile in tiles {
            if tile.frame.intersects(window) {
                tile.renderIfNeeded(color: color)
            } else {
                tile.releaseContents()
            }
        }
    }

    // MARK: Zoom

    @objc private func handlePinch(_ recognizer: UIPinchGestureRecognizer) {
        switch recognizer.state {
        case .began:
            pinchStartZoom = zoom
        case .changed:
            zoom = clampedZoom(pinchStartZoom * recognizer.scale)
            // Transient visual feedback: scale the already-drawn tiles relative to the zoom they
            // were laid out at, so the pinch tracks the fingers immediately; the debounced
            // `relayout` then snaps in a crisp re-engraved layout at the settled zoom.
            let ratio = renderedZoom > 0 ? zoom / renderedZoom : 1
            contentView.layer.transform = CATransform3DMakeScale(ratio, ratio, 1)
            scheduleReflow()
        case .ended, .cancelled, .failed:
            zoom = clampedZoom(pinchStartZoom * recognizer.scale)
            relayout()
        default:
            break
        }
    }

    private func clampedZoom(_ value: CGFloat) -> CGFloat {
        min(max(value.isFinite ? value : 1, Self.zoomMin), Self.zoomMax)
    }

}

// MARK: - UIScrollViewDelegate

extension NotationView: UIScrollViewDelegate {
    public func scrollViewDidScroll(_ scrollView: UIScrollView) {
        // Fires on every frame of the scroll-mode auto-follow translation — cheap by design.
        // `updateVisibleSystems` only re-draws or releases a tile whose visible/hidden state
        // actually flipped (`renderIfNeeded` no-ops on an already-drawn tile, `releaseContents`
        // on an already-released one), so a steady follow that keeps the same tiles on screen does
        // no rendering work; it just walks the tile list comparing frames.
        updateVisibleSystems()
    }

    /// A user drag suspends auto-follow; it resumes after ~2 s idle (in `applyCursor`) or on a seek.
    public func scrollViewWillBeginDragging(_ scrollView: UIScrollView) {
        followController.userInteracted(now: CACurrentMediaTime())
    }
}
