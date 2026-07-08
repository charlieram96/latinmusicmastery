import PlaySenseCore
import PlaySenseHighway
import XCTest

@testable import PlaySenseUI

/// Scripted timelines against ``HighwayResultVisualizer`` — the bridge-level diffing that decides which
/// graded events to visualize on the highway each tick. Covers the ordinary new-result path, the cheap
/// no-op-tick guard (D24 fix round 1, item 2), and the tentative-miss-then-correction scenario (item 1),
/// where the assertion is the *documented web-parity* behavior established by reading
/// `GlassHighway.tsx` + `use-exercise-session.ts`: a corrected grade is recorded but does not re-fire the
/// highway effect.
final class HighwayResultVisualizerTests: XCTestCase {

    private func result(_ eventIndex: Int, _ grade: HitGrade) -> EventResult {
        EventResult(eventIndex: eventIndex, grade: grade, offsetMs: nil, timing: nil, onsetEnergy: nil)
    }

    // MARK: - Ordinary new-result path

    func testFiresOnceForEachNewResult() {
        var visualizer = HighwayResultVisualizer()
        let fired = visualizer.diff([result(0, .perfect), result(1, .miss)])
        XCTAssertEqual(fired.map(\.eventIndex), [0, 1])
        XCTAssertEqual(fired.map(\.kind), [.perfect, .miss])
    }

    func testDoesNotRefireAnUnchangedResultOnSubsequentTicks() {
        var visualizer = HighwayResultVisualizer()
        _ = visualizer.diff([result(0, .perfect)])
        // Same array, same content, called again (e.g. two ticks before anything new is graded).
        let secondTick = visualizer.diff([result(0, .perfect)])
        XCTAssertTrue(secondTick.isEmpty)
    }

    // MARK: - Cheap tick guard (item 2)

    func testNoOpTickShortCircuitsWithoutInspectingContent() {
        var visualizer = HighwayResultVisualizer()
        _ = visualizer.diff([result(0, .perfect)])
        // A tick where `hudResults` is the exact same length as last time short-circuits on the count
        // check alone — even if (hypothetically) its content looked different, nothing fires. This models
        // the fast path the bridge hits on the overwhelming majority of its 120 Hz ticks, when nothing has
        // been graded since the last one.
        let sameLength = visualizer.diff([result(0, .good)]) // pretend a same-length swap slipped through
        XCTAssertTrue(sameLength.isEmpty, "same result count must short-circuit before any content diff")
    }

    // MARK: - Tentative miss → corrected hit (item 1)

    /// The exact scenario `LiveScorer.applySingleResult`/`gradeChordDeferred` produce: a tentative miss is
    /// visualized, then a later-arriving hit corrects it. `hudResults` reflects this as LiveScorer does —
    /// remove the stale miss, append the corrected result — which is a same-length replace when nothing
    /// else was graded in between.
    func testCorrectedMissIsRecordedButDoesNotRefireTheHighwayEffect() {
        var visualizer = HighwayResultVisualizer()

        // Tentative miss lands and is visualized.
        let firstTick = visualizer.diff([result(0, .miss)])
        XCTAssertEqual(firstTick.map(\.eventIndex), [0])
        XCTAssertEqual(firstTick.map(\.kind), [.miss])

        // LiveScorer un-misses it: the stale `.miss` result is gone, a `.perfect` result stands in its
        // place at the same array length (1 result, same as before the correction).
        let correctionTick = visualizer.diff([result(0, .perfect)])

        // Documented web-parity behavior (see `HighwayResultVisualizer`'s doc comment): the web's own
        // `GlassHighway.tsx`/`use-exercise-session.ts` never re-fires `triggerHitEffect` for this exact
        // shape of correction either, because `eventResultsLength` doesn't grow. We match that — the
        // highway does NOT get a second effect for event 0; only the HUD (driven independently from
        // `LiveScorer`'s live stats) reflects the correction.
        XCTAssertTrue(
            correctionTick.isEmpty,
            "matches the web's contract: a same-length miss→hit correction does not re-fire the highway effect"
        )
    }

    /// A correction that happens to land in the SAME tick as a brand-new, unrelated result: only the truly
    /// new event fires — the correction is still suppressed. This mirrors the web's index-shift quirk
    /// (`prevEventCountRef` only ever looks at the newly-grown tail).
    func testCorrectionAlongsideANewResultOnlyFiresTheNewOne() {
        var visualizer = HighwayResultVisualizer()
        _ = visualizer.diff([result(0, .miss)])

        // Event 0's miss is corrected to `.ok` AND event 1 is graded for the first time — net +1 length.
        let tick = visualizer.diff([result(0, .ok), result(1, .miss)])
        XCTAssertEqual(tick.map(\.eventIndex), [1], "only the genuinely new event (1) should fire")
        XCTAssertEqual(tick.map(\.kind), [.miss])
    }

    // MARK: - Reset

    func testResetClearsBookkeepingForAFreshTake() {
        var visualizer = HighwayResultVisualizer()
        _ = visualizer.diff([result(0, .perfect)])
        visualizer.reset()
        // A fresh take reuses eventIndex 0 from scratch — it should fire again, not be treated as a repeat.
        let afterReset = visualizer.diff([result(0, .perfect)])
        XCTAssertEqual(afterReset.map(\.eventIndex), [0])
    }
}
