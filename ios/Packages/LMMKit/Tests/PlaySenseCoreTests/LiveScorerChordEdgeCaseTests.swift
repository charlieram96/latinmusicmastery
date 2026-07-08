import XCTest

@testable import PlaySenseCore

/// The two dedicated chord edge cases called out in the D23 fix round: a take that stops mid-deferred-chord
/// (the reserved-but-ungraded group must fill as miss at finish), and an onset that lands on an
/// already-chord-reserved index (it must count as an extra hit, not a double-match). Split out of
/// ``LiveScorerTests`` to keep that file within the length limits; shares the same scripted-timeline shape.
final class LiveScorerChordEdgeCaseTests: XCTestCase {

    private let t0Seconds: Double = 100.0

    private func pitchedScorer(_ events: [ExpectedEvent], scheduler: DeferredScheduler) -> LiveScorer {
        LiveScorer(
            expectedEvents: events,
            difficulty: .beginner,
            instrumentCategory: .pitched,
            calibrationOffsetSec: 0,
            widenMs: 0,
            t0Seconds: t0Seconds,
            scheduler: scheduler
        )
    }

    private func onset(relative: Double, frequency: Double? = nil) -> OnsetEvent {
        OnsetEvent(timestamp: t0Seconds + relative, energy: 1, frequency: frequency)
    }

    private func chordEvents() -> [ExpectedEvent] {
        [
            ExpectedEvent(eventIndex: 0, timestamp: 1.0, expectedPitch: 60, chordId: "c0"),
            ExpectedEvent(eventIndex: 1, timestamp: 1.0, expectedPitch: 64, chordId: "c0")
        ]
    }

    /// Stop mid-deferred-chord: an onset reserves the whole chord group and schedules the deferred grade,
    /// but the take finishes before the chroma-wait window elapses. `finish` cancels the deferred grade and
    /// the reserved-but-ungraded group fills as miss — it must NOT linger as "matched but unscored".
    func testStopMidDeferredChordFillsReservedGroupAsMiss() {
        let scheduler = ManualDeferredScheduler()
        let scorer = pitchedScorer(chordEvents(), scheduler: scheduler)

        scorer.ingest(onset(relative: 1.0)) // reserves group c0, defers grading
        XCTAssertEqual(scheduler.pendingCount, 1)
        XCTAssertEqual(scorer.snapshot.results.count, 0, "grading is deferred; nothing scored yet")

        let stats = scorer.finish(actualDurationSeconds: 2.0) // stop before the deferred grade fires

        XCTAssertEqual(scheduler.pendingCount, 0, "finish cancels the pending deferred chord grade")
        XCTAssertEqual(scorer.finalResults.count, 2)
        XCTAssertTrue(scorer.finalResults.allSatisfy { $0.grade == .miss },
                      "a reserved-but-ungraded chord group fills as miss at finish")
        XCTAssertEqual(stats.missCount, 2)
        XCTAssertEqual(stats.extraHits, 0)
    }

    /// A second onset landing on an already-chord-reserved index is an extra hit, not a double-match: the
    /// group is already reserved so it matches no unmatched event.
    func testOnsetOnAlreadyReservedChordIndexIsExtraHit() {
        let scheduler = ManualDeferredScheduler()
        let scorer = pitchedScorer(chordEvents(), scheduler: scheduler)

        scorer.ingest(onset(relative: 1.0)) // reserves the whole group
        XCTAssertEqual(scheduler.pendingCount, 1)

        // Second onset on the same (reserved) index. It carries a frequency so it does NOT itself defer;
        // routing finds the group already matched, single-onset grading finds no unmatched event.
        scorer.ingest(onset(relative: 1.0, frequency: 261.63))
        let stats = scorer.finish(actualDurationSeconds: 2.0)

        XCTAssertEqual(stats.extraHits, 1, "an onset on an already-reserved chord index counts as an extra hit")
    }
}
