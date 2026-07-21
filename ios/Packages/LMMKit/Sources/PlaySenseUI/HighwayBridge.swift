import PlaySenseCore
import PlaySenseHighway
import QuartzCore

/// Adapts the D23 ``SessionCoordinator`` to the ``HighwayScene`` without touching `LiveScorer`
/// semantics. The coordinator is the sole authority for grades; the highway is a pure renderer.
///
/// Each display frame (its own ``DisplayLinkDriver``, so the scene's SpriteKit render loop and the
/// coordinator's grading loop both stay untouched) the bridge:
///   1. pushes the live per-frame inputs (playhead / score / combo / accuracy) onto the scene, and
///   2. diffs the coordinator's graded-results timeline (via ``HighwayResultVisualizer``) and fires
///      `triggerHitEffect` / `triggerMiss` once per newly-graded event, so the note choreography matches
///      the real scoring.
///
/// The ≤100 ms HUD throttle means a hit's visual flash lands a beat after the grade; the note is
/// still at the line then, so it reads correctly and keeps the scorer authoritative.
///
/// A tentative miss that `LiveScorer` later corrects to a real hit is deliberately NOT re-visualized —
/// see ``HighwayResultVisualizer``'s doc comment for the web-parity verification behind that call.
@MainActor
final class HighwayBridge {
    let scene: HighwayScene
    private weak var coordinator: SessionCoordinator?
    private var driver: DisplayLinkDriver?
    private var visualizer = HighwayResultVisualizer()

    init(scene: HighwayScene, coordinator: SessionCoordinator) {
        self.scene = scene
        self.coordinator = coordinator
    }

    func start() {
        stop()
        let driver = DisplayLinkDriver { [weak self] in self?.tick() }
        driver.start()
        self.driver = driver
    }

    func stop() {
        driver?.stop()
        driver = nil
    }

    /// Reset the once-per-event visual latch (a fresh take reuses event indices).
    func reset() {
        visualizer.reset()
    }

    private func tick() {
        guard let coordinator else { return }
        scene.playheadProgress = coordinator.playheadProgress
        scene.currentScore = coordinator.hudScore
        scene.currentCombo = coordinator.hudCombo
        scene.currentAccuracy = coordinator.hudAccuracy

        // `diff` short-circuits to `[]` when `hudResults` hasn't grown/shrunk since the last tick — the
        // common case — so most frames never touch the (potentially long) results array at all.
        for (eventIndex, kind) in visualizer.diff(coordinator.hudResults) {
            if kind == .miss {
                scene.triggerMiss(eventIndex: eventIndex)
            } else {
                scene.triggerHitEffect(eventIndex: eventIndex, grade: kind)
            }
        }
    }

    /// Pure `HitGrade` → renderer-grade mapping; `nonisolated` so the (also pure)
    /// ``HighwayResultVisualizer`` can call it outside the main actor.
    nonisolated static func kind(for grade: HitGrade) -> HitGradeKind {
        switch grade {
        case .perfect: return .perfect
        case .good: return .good
        case .ok: return .ok
        case .miss: return .miss
        }
    }
}
