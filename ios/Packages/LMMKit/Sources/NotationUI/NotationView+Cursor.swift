import NotationEngraving
import ScoreModel
import UIKit

/// The C18 cursor / video-sync surface of ``NotationView``: an amber playhead line + current-
/// measure glow that ride above the tiles (transform/frame-only updates, no re-render), auto-
/// follow that scrolls the active row/strip into view, and tap-to-seek off the note anchors.
public extension NotationView {
    /// Move the playhead to a score-relative millisecond position. Called imperatively from the
    /// video clock (per frame while playing, and on each paused seek) — never through SwiftUI, so
    /// there is no per-frame view invalidation.
    func setCursorTime(scoreMs: Double) {
        cursorScoreMs = scoreMs
        applyCursor(animated: false)
    }

    /// Show/hide the playhead (hidden in gaps between sections and before any notation begins).
    func setCursorVisible(_ visible: Bool) {
        guard cursorIsVisible != visible else { return }
        cursorIsVisible = visible
        if visible { lastFollowedSystem = -1 }
        applyCursor(animated: false)
    }
}

extension NotationView {
    /// Brand amber, matching the web playhead / active-note tint.
    private static let cursorColor = UIColor(red: 0.94, green: 0.62, blue: 0.22, alpha: 1)

    func setUpCursorLayers() {
        measureHighlight.backgroundColor = Self.cursorColor.withAlphaComponent(0.14).cgColor
        measureHighlight.cornerRadius = 3
        measureHighlight.opacity = 0
        measureHighlight.zPosition = 900
        measureHighlight.actions = ["position": NSNull(), "bounds": NSNull(), "opacity": NSNull()]
        contentView.layer.addSublayer(measureHighlight)

        cursorLine.backgroundColor = Self.cursorColor.cgColor
        cursorLine.cornerRadius = 1
        cursorLine.opacity = 0
        cursorLine.zPosition = 1000
        cursorLine.anchorPoint = CGPoint(x: 0.5, y: 0.5)
        cursorLine.actions = ["position": NSNull(), "bounds": NSNull(), "opacity": NSNull()]
        contentView.layer.addSublayer(cursorLine)
    }

    /// Rebuild the pure cursor geometry from a fresh layout and size the playhead to the staff.
    func rebuildCursorGeometry(for layout: ScoreLayout, track: Track, score: ScoreDocument) {
        let totalMs = ScoreTime.trackDurationMs(track: track, score: score)
        cursorGeometry = CursorGeometry(layout: layout, totalDurationMs: totalMs)
        let staffSpace = layout.systems.first?.staffSpace ?? (baseStaffSpacePoints * zoom)
        // Vertical extent: one space of overhang above the top line and below the bottom line
        // (5 lines span 4 spaces) → 6 spaces tall.
        cursorLine.bounds = CGRect(x: 0, y: 0, width: max(2, staffSpace * 0.22), height: staffSpace * 6)
        lastFollowedSystem = -1
        applyCursor(animated: false)
    }

    /// Position the playhead + measure glow for the current score-ms, then auto-follow if engaged.
    func applyCursor(animated: Bool) {
        // Resume auto-follow once the post-drag idle window elapses (driven by playback frames).
        if followController.tick(now: CACurrentMediaTime()) { lastFollowedSystem = -1 }

        guard cursorIsVisible,
              let geometry = cursorGeometry,
              let layout = scoreLayout,
              let position = geometry.cursorPosition(scoreMs: cursorScoreMs),
              position.system >= 0, position.system < layout.systems.count else {
            hideCursor()
            return
        }
        let system = layout.systems[position.system]
        let staffSpace = system.staffSpace

        CATransaction.begin()
        CATransaction.setDisableActions(true)
        cursorLine.position = CGPoint(x: position.x, y: system.topLineY + staffSpace * 2)
        cursorLine.opacity = 0.9
        if let measureRect = geometry.activeMeasure(scoreMs: cursorScoreMs) {
            measureHighlight.frame = measureRect
            measureHighlight.opacity = 1
        } else {
            measureHighlight.opacity = 0
        }
        CATransaction.commit()

        if followController.following {
            autoFollow(cursorX: position.x, system: position.system, systemFrame: system, animated: animated)
        }
    }

    private func hideCursor() {
        CATransaction.begin()
        CATransaction.setDisableActions(true)
        cursorLine.opacity = 0
        measureHighlight.opacity = 0
        CATransaction.commit()
    }

    /// Keep the playhead in view: wrapped mode scrolls a changed row ~24 pt from the top; scroll
    /// mode translates the strip so the playhead stays at 8 % of the viewport width.
    private func autoFollow(cursorX: CGFloat, system: Int, systemFrame: SystemFrame, animated: Bool) {
        switch mode {
        case .wrapped:
            guard system != lastFollowedSystem else { return }
            lastFollowedSystem = system
            let maxOffsetY = max(0, scrollView.contentSize.height - scrollView.bounds.height)
            let targetY = min(max(0, systemFrame.topLineY - 24), maxOffsetY)
            scrollView.setContentOffset(CGPoint(x: 0, y: targetY), animated: animated)
        case .scroll:
            let anchor = scrollView.bounds.width * Self.cursorAnchorFraction
            let maxOffsetX = max(0, scrollView.contentSize.width - scrollView.bounds.width)
            let targetX = min(max(0, cursorX - anchor), maxOffsetX)
            scrollView.setContentOffset(CGPoint(x: targetX, y: 0), animated: false)
        }
    }

    @objc func handleTap(_ recognizer: UITapGestureRecognizer) {
        guard let geometry = cursorGeometry, !geometry.isEmpty, let onSeekQN else { return }
        let point = recognizer.location(in: contentView)
        guard let quarter = geometry.quarterNote(at: point, mode: mode) else { return }
        // A seek re-engages follow (brief: resume on seek) so the playhead lands where tapped and
        // the view tracks from there.
        followController.didSeek()
        lastFollowedSystem = -1
        onSeekQN(quarter)
    }
}
