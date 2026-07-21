import PlaySenseCore
import ScoreModel
import SpriteKit
import XCTest

@testable import PlaySenseHighway

/// Frame-budget check for the pooled highway. Sweeps a full synthetic session through
/// `HighwayScene.update(_:)` (the per-frame CPU work: note selection + pooled-sprite transforms,
/// effects, receptors, dust) and records the average/max cost per frame. The 120 fps ProMotion
/// budget is 8.3 ms/frame and the 60 fps floor is 16.6 ms.
///
/// SCOPE OF THE CLAIM (D24 fix round 1): what this measures is the `update(_:)` CPU cost only, on
/// whatever host runs the suite (typically the Simulator on a dev Mac). It says nothing about GPU
/// render cost, SpriteKit's own culling/batching overhead, or real frame pacing on device — those
/// remain unverified until D27's on-device pass. Within that scope, "no allocation" applies to the
/// sprite/texture layer (fully pooled, stamped from baked textures — no per-frame tessellation or
/// sprite/texture allocation); the pure `NoteFieldModel.frame()` DOES allocate its small output
/// arrays each frame (see the `NoteFrame` doc comment for why that's accepted).
final class HighwayPerformanceTests: XCTestCase {

    @MainActor
    func testFullSessionUpdateStaysWellWithinFrameBudget() {
        let exercise = manyNoteExercise()
        let scene = HighwayScene(size: CGSize(width: 402, height: 874))
        scene.size = CGSize(width: 402, height: 874)
        scene.configure(exercise: exercise)

        let frames = 900 // ~7.5 s at 120 fps
        var maxMs = 0.0
        var totalMs = 0.0
        var now = 0.0

        for frame in 0..<frames {
            now += 1.0 / 120
            scene.playheadProgress = Double(frame) / Double(frames)
            scene.currentScore = Double(frame)
            scene.currentCombo = frame / 8
            if frame % 10 == 0, let index = scene.closestEventIndex() {
                scene.triggerHitEffect(eventIndex: index, grade: .perfect)
            }
            let start = CFAbsoluteTimeGetCurrent()
            scene.update(now)
            let frameMs = (CFAbsoluteTimeGetCurrent() - start) * 1000
            maxMs = max(maxMs, frameMs)
            totalMs += frameMs
        }

        let avgMs = totalMs / Double(frames)
        let nodeCount = countNodes(scene)
        NSLog("[HighwayPerf] avg=%.3f ms/frame max=%.3f ms over %d frames; nodes=%d " +
              "(120fps budget 8.3ms, 60fps 16.6ms)", avgMs, maxMs, frames, nodeCount)

        // Loose, non-flaky bounds — the real figures are ~an order of magnitude under these.
        XCTAssertLessThan(avgMs, 4.0, "avg per-frame CPU work should be a small fraction of the 8.3ms budget")
        XCTAssertLessThan(maxMs, 8.3, "no frame's CPU work should blow the 120fps budget")
    }

    private func countNodes(_ node: SKNode) -> Int {
        1 + node.children.reduce(0) { $0 + countNodes($1) }
    }

    /// A dense conga session (4 measures × 8 sixteenths, looped) to fill the note field.
    private func manyNoteExercise() -> ExerciseDefinition {
        let surfaces = ["quinto", "conga", "tumba"]
        var events: [ExerciseEvent] = []
        for measure in 1...4 {
            for step in 0..<8 {
                events.append(ExerciseEvent(
                    beat: 1 + Double(step) * 0.5, measure: measure, instrument: .conga,
                    technique: .open, hand: step.isMultiple(of: 2) ? .right : .left,
                    duration: 0.5, vexKey: "g/4", accent: step == 0,
                    surface: surfaces[step % 3]
                ))
            }
        }
        return ExerciseDefinition(
            id: "perf-conga", title: "Perf", description: "", instrument: .conga, bpm: 120,
            timeSignature: TimeSignature(numerator: 4, denominator: 4), swing: 0,
            difficulty: .intermediate, measures: 4, loopCount: 2, events: events
        )
    }
}
