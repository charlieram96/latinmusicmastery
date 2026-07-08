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
/// No cursor / playhead yet — that (and click-to-seek off `scoreLayout.noteAnchors`) lands in
/// C18. `setContentOffset(_:animated:)` is exposed now so the future auto-scroll can drive it.
public final class NotationView: UIView {
    // MARK: Zoom bounds (ported from staff-renderer.tsx)

    public static let zoomMin: CGFloat = 0.5
    public static let zoomMax: CGFloat = 2.6

    /// Points per staff space at zoom 1. The whole staff scales off this single knob; the web's
    /// 10 model-px/space × BASE_SCALE 1.3 ≈ 13 rendered px is the reference — 10 keeps a 4/4 bar
    /// (~360 pt) filling a phone row while an iPad packs two.
    public var baseStaffSpacePoints: CGFloat = 10 { didSet { relayout() } }

    // MARK: State

    private let scrollView = UIScrollView()
    private let contentView = UIView()
    private var tiles: [SystemTileLayer] = []

    private var score: ScoreDocument?
    private var track: Track?
    private var measures: [MeasureDescriptor] = []
    private var mode: StaffLayoutMode = .wrapped
    private var zoom: CGFloat = 1

    private(set) var scoreLayout: ScoreLayout?
    private var lastLayoutWidth: CGFloat = 0
    private var reflowWorkItem: DispatchWorkItem?
    private var pinchStartZoom: CGFloat = 1

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
        let width = bounds.width
        guard width > 0, !measures.isEmpty, let track, let score else {
            tiles.forEach { $0.removeFromSuperlayer() }
            tiles = []
            scoreLayout = nil
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
        updateVisibleSystems()
    }

    private func rebuildTiles(for layout: ScoreLayout) {
        tiles.forEach { $0.removeFromSuperlayer() }
        contentView.frame = CGRect(origin: .zero, size: layout.totalSize)
        scrollView.contentSize = layout.totalSize
        let displayScale = traitCollection.displayScale > 0 ? traitCollection.displayScale : 2
        tiles = layout.systems.map { system in
            let tile = SystemTileLayer(system: system, contentHeight: layout.totalSize.height)
            tile.frame = system.frame
            tile.contentsScale = displayScale
            contentView.layer.addSublayer(tile)
            return tile
        }
    }

    // MARK: Windowing (draw once; release outside visible rect + 1 screen)

    /// System indices whose tile currently holds drawn `contents` — the test seam for windowing.
    var renderedSystemIndices: Set<Int> {
        Set(tiles.filter { $0.contents != nil }.map(\.system.index))
    }

    /// Re-evaluate which system tiles should be drawn: any intersecting the visible rect expanded
    /// by one screen height are rendered; the rest release their `contents`.
    func updateVisibleSystems() {
        guard !tiles.isEmpty else { return }
        let visible = CGRect(origin: scrollView.contentOffset, size: scrollView.bounds.size)
        let window = visible.insetBy(dx: 0, dy: -visible.height)
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
        updateVisibleSystems()
    }
}
