import XCTest

@testable import PlaySenseCore

/// The LiveScorer determinism matrix — the core deliverable of D23. Each case scripts an onset+clock
/// timeline against a ``ManualDeferredScheduler`` and asserts the exact graded result, porting the
/// orchestration semantics of `hooks/use-exercise-session.ts`.
///
/// The individual grade OUTCOMES (perfect/good/ok/miss thresholds, chord presence, pitch judgment) are
/// already byte-parity with the web via the D19 golden fixtures (`ScoringVitestTests` etc.); this suite
/// exercises the ORCHESTRATION on top of those pure functions — routing, reservation, deferral, un-miss,
/// dedupe, extra-hit, pre-t0 drop, calibration — which the hook itself cannot run in Node (documented in the
/// D23 report as the reason orchestration parity rests on this matrix + code review).
final class LiveScorerTests: XCTestCase {

    private let t0Seconds: Double = 100.0 // large-magnitude t0 (seconds-since-boot) to catch float bugs

    // MARK: - Factories

    private func percussionScorer(
        _ events: [ExpectedEvent],
        difficulty: Difficulty = .beginner,
        calibrationOffsetSec: Double = 0,
        widenMs: Double = 0,
        scheduler: DeferredScheduler
    ) -> LiveScorer {
        LiveScorer(
            expectedEvents: events,
            difficulty: difficulty,
            instrumentCategory: .percussion,
            calibrationOffsetSec: calibrationOffsetSec,
            widenMs: widenMs,
            t0Seconds: t0Seconds,
            scheduler: scheduler
        )
    }

    private func pitchedScorer(
        _ events: [ExpectedEvent],
        difficulty: Difficulty = .beginner,
        scheduler: DeferredScheduler
    ) -> LiveScorer {
        LiveScorer(
            expectedEvents: events,
            difficulty: difficulty,
            instrumentCategory: .pitched,
            calibrationOffsetSec: 0,
            widenMs: 0,
            t0Seconds: t0Seconds,
            scheduler: scheduler
        )
    }

    private func onset(
        relative: Double,
        energy: Double = 1,
        frequency: Double? = nil,
        surface: String? = nil
    ) -> OnsetEvent {
        OnsetEvent(timestamp: t0Seconds + relative, energy: energy, frequency: frequency, surface: surface)
    }

    // MARK: - 1. On-time hit

    func testOnTimeHitGradesPerfect() {
        let scheduler = ManualDeferredScheduler()
        let scorer = percussionScorer([ExpectedEvent(eventIndex: 0, timestamp: 1.0)], scheduler: scheduler)

        scorer.ingest(onset(relative: 1.0))
        let stats = scorer.finish(actualDurationSeconds: 2.0)

        XCTAssertEqual(scorer.finalResults.count, 1)
        XCTAssertEqual(scorer.finalResults[0].grade, .perfect)
        XCTAssertEqual(scorer.finalResults[0].offsetMs ?? .nan, 0, accuracy: 0.01)
        XCTAssertEqual(stats.perfectCount, 1)
        XCTAssertEqual(stats.missCount, 0)
        XCTAssertEqual(stats.score, 100, accuracy: 0.01)
    }

    // MARK: - 2. Late un-miss replacement

    func testLateHitUnMissesTentativeMiss() {
        let scheduler = ManualDeferredScheduler()
        let scorer = percussionScorer([ExpectedEvent(eventIndex: 0, timestamp: 1.0)], scheduler: scheduler)

        // Miss-detector passes the event's Ok window (+200ms buffer) → tentative miss.
        let okWindow = (toleranceByDifficulty[.beginner]!.ok + 200) / 1000
        scorer.checkTentativeMisses(elapsedSeconds: 1.0 + okWindow + 0.01)
        XCTAssertEqual(scorer.snapshot.results.first?.grade, .miss)

        // A hit whose timestamp is WITHIN the Ok window but ingested late (out of order) replaces the miss.
        scorer.ingest(onset(relative: 1.05)) // +50ms → good
        let stats = scorer.finish(actualDurationSeconds: 2.0)

        XCTAssertEqual(scorer.finalResults.count, 1)
        XCTAssertEqual(scorer.finalResults[0].grade, .good, "late hit should replace the tentative miss")
        XCTAssertEqual(stats.missCount, 0)
        XCTAssertEqual(stats.goodCount, 1)
    }

    // MARK: - 3. Chord reserve + deferred grade with chroma

    func testChordReservesGroupAndGradesWithChroma() {
        let scheduler = ManualDeferredScheduler()
        let events = [
            ExpectedEvent(eventIndex: 0, timestamp: 1.0, expectedPitch: 60, chordId: "c0"), // C
            ExpectedEvent(eventIndex: 1, timestamp: 1.0, expectedPitch: 64, chordId: "c0")  // E
        ]
        let scorer = pitchedScorer(events, scheduler: scheduler)

        var chroma = [Double](repeating: 0, count: 12)
        chroma[0] = 1.0 // C present
        chroma[4] = 1.0 // E present
        let expectedKey = Int(((t0Seconds + 1.0) * 1000).rounded())
        scorer.chromaProvider = { key in key == expectedKey ? chroma : nil }

        scorer.ingest(onset(relative: 1.0))
        // Group reserved immediately; grading deferred until the chroma-wait window elapses.
        XCTAssertEqual(scorer.snapshot.results.count, 0)
        XCTAssertEqual(scheduler.pendingCount, 1)

        scheduler.advance(byMilliseconds: LiveScorer.chordGradeDelayMs)
        let stats = scorer.finish(actualDurationSeconds: 2.0)

        XCTAssertEqual(scorer.finalResults.count, 2)
        XCTAssertTrue(scorer.finalResults.allSatisfy { $0.grade == .perfect })
        XCTAssertEqual(stats.pitchAccuracy, 100)
    }

    func testChordMissingChromaBinDowngradesGroupTogether() {
        let scheduler = ManualDeferredScheduler()
        let events = [
            ExpectedEvent(eventIndex: 0, timestamp: 1.0, expectedPitch: 60, chordId: "c0"),
            ExpectedEvent(eventIndex: 1, timestamp: 1.0, expectedPitch: 64, chordId: "c0"),
            ExpectedEvent(eventIndex: 2, timestamp: 1.0, expectedPitch: 67, chordId: "c0")
        ]
        // advanced: requiredChordPresenceRatio 1.0, so a missing tone downgrades.
        let scorer = pitchedScorer(events, difficulty: .advanced, scheduler: scheduler)

        var chroma = [Double](repeating: 0, count: 12)
        chroma[0] = 1.0  // C present
        chroma[4] = 1.0  // E present
        // G (pc 7) missing → ratio 2/3 ≈ 0.66 < 1.0 → downgrade by one level from perfect → good.
        scorer.chromaProvider = { _ in chroma }

        scorer.ingest(onset(relative: 1.0))
        scheduler.advance(byMilliseconds: LiveScorer.chordGradeDelayMs)
        scorer.finish(actualDurationSeconds: 2.0)

        XCTAssertEqual(Set(scorer.finalResults.map(\.grade)), [.good], "whole group shares the downgraded grade")
    }

    // MARK: - 4. Pitched deferred re-read

    func testPitchedOnsetDefersAndRereadsPitch() {
        let scheduler = ManualDeferredScheduler()
        let events = [ExpectedEvent(eventIndex: 0, timestamp: 1.0, expectedPitch: 60)]
        let scorer = pitchedScorer(events, scheduler: scheduler)

        // No pitch at onset time → deferred, nothing graded yet.
        scorer.ingest(onset(relative: 1.0, frequency: nil))
        XCTAssertEqual(scorer.snapshot.results.count, 0)
        XCTAssertEqual(scheduler.pendingCount, 1)

        // Pitch stabilizes (C4 ≈ 261.63 Hz → MIDI 60) before the re-read fires.
        scorer.pitchFrequencyProvider = { 261.63 }
        scheduler.advance(byMilliseconds: LiveScorer.pitchDeferMs)
        scorer.finish(actualDurationSeconds: 2.0)

        XCTAssertEqual(scorer.finalResults.count, 1)
        XCTAssertEqual(scorer.finalResults[0].grade, .perfect)
        XCTAssertEqual(scorer.finalResults[0].pitchCorrect, .correct)
    }

    func testPitchedDeferredWithNoPitchBecomesExtraHit() {
        let scheduler = ManualDeferredScheduler()
        let events = [ExpectedEvent(eventIndex: 0, timestamp: 1.0, expectedPitch: 60)]
        let scorer = pitchedScorer(events, scheduler: scheduler)

        // Onset far from any event; still deferred (pitched, no pitch), then re-read yields nothing → no
        // match → extra hit (hook's `else { extraHitsRef.current++ }` in the deferred path).
        scorer.ingest(onset(relative: 5.0, frequency: nil))
        scheduler.advance(byMilliseconds: LiveScorer.pitchDeferMs)
        let stats = scorer.finish(actualDurationSeconds: 6.0)

        XCTAssertEqual(stats.extraHits, 1)
        XCTAssertEqual(scorer.finalResults[0].grade, .miss, "the untouched event fills as a miss")
    }

    // MARK: - 5. Extra hit

    func testUnmatchedOnsetCountsAsExtraHit() {
        let scheduler = ManualDeferredScheduler()
        let scorer = percussionScorer([ExpectedEvent(eventIndex: 0, timestamp: 1.0)], scheduler: scheduler)

        scorer.ingest(onset(relative: 5.0)) // nowhere near the event
        let stats = scorer.finish(actualDurationSeconds: 6.0)

        XCTAssertEqual(stats.extraHits, 1)
        XCTAssertEqual(scorer.finalResults.count, 1)
        XCTAssertEqual(scorer.finalResults[0].grade, .miss)
    }

    // MARK: - 6. Refractory-adjacent duplicates

    func testSecondAdjacentOnsetIsExtraHitNotDoubleMatch() {
        let scheduler = ManualDeferredScheduler()
        let scorer = percussionScorer([ExpectedEvent(eventIndex: 0, timestamp: 1.0)], scheduler: scheduler)

        scorer.ingest(onset(relative: 1.0))  // matches e0 (perfect)
        scorer.ingest(onset(relative: 1.02)) // e0 already matched → no unmatched event → extra hit
        let stats = scorer.finish(actualDurationSeconds: 2.0)

        XCTAssertEqual(scorer.finalResults.count, 1)
        XCTAssertEqual(scorer.finalResults[0].grade, .perfect)
        XCTAssertEqual(stats.extraHits, 1)
    }

    // MARK: - 7. Finish dedupe (prefers non-miss) + fill unmatched

    func testFinishDedupesFillsAndSorts() {
        let scheduler = ManualDeferredScheduler()
        let events = [
            ExpectedEvent(eventIndex: 0, timestamp: 1.0),
            ExpectedEvent(eventIndex: 1, timestamp: 2.0),
            ExpectedEvent(eventIndex: 2, timestamp: 3.0)
        ]
        let scorer = percussionScorer(events, scheduler: scheduler)
        let okWindow = (toleranceByDifficulty[.beginner]!.ok + 200) / 1000

        scorer.ingest(onset(relative: 1.0))                                  // e0 perfect
        scorer.checkTentativeMisses(elapsedSeconds: 2.0 + okWindow + 0.01)   // e1 tentative miss
        scorer.ingest(onset(relative: 2.0))                                  // e1 un-missed → perfect
        // e2 never touched.
        scorer.finish(actualDurationSeconds: 4.0)

        XCTAssertEqual(scorer.finalResults.map(\.eventIndex), [0, 1, 2], "sorted, one per event")
        XCTAssertEqual(scorer.finalResults[0].grade, .perfect)
        XCTAssertEqual(scorer.finalResults[1].grade, .perfect, "the un-missed hit is preferred over the miss")
        XCTAssertEqual(scorer.finalResults[2].grade, .miss, "untouched event filled as miss")
    }

    // MARK: - 8. Pre-t0 drop

    func testOnsetBeforeT0IsDroppedNotCounted() {
        let scheduler = ManualDeferredScheduler()
        let scorer = percussionScorer([ExpectedEvent(eventIndex: 0, timestamp: 1.0)], scheduler: scheduler)

        scorer.ingest(onset(relative: -0.1)) // count-in tap before t0
        let stats = scorer.finish(actualDurationSeconds: 2.0)

        XCTAssertEqual(stats.extraHits, 0, "count-in taps are dropped, not counted as extra hits")
        XCTAssertEqual(scorer.finalResults[0].grade, .miss)
    }

    // MARK: - 9. Calibration offset

    func testCalibrationOffsetShiftsGradingClock() {
        let scheduler = ManualDeferredScheduler()
        // Capture latency of 50ms: an onset landing 50ms late corrects back to on-time.
        let scorer = percussionScorer(
            [ExpectedEvent(eventIndex: 0, timestamp: 1.0)],
            calibrationOffsetSec: 0.05,
            scheduler: scheduler
        )

        scorer.ingest(onset(relative: 1.05))
        scorer.finish(actualDurationSeconds: 2.0)

        XCTAssertEqual(scorer.finalResults[0].grade, .perfect, "50ms calibration offset corrects a +50ms onset")
    }

    // MARK: - 10. Widen

    func testWidenExpandsToleranceWindows() {
        let scheduler = ManualDeferredScheduler()
        // Beginner Ok = 110ms; a +120ms onset is a miss without widening.
        let strict = percussionScorer([ExpectedEvent(eventIndex: 0, timestamp: 1.0)], scheduler: scheduler)
        strict.ingest(onset(relative: 1.12))
        strict.finish(actualDurationSeconds: 2.0)
        XCTAssertEqual(strict.finalResults[0].grade, .miss, "without widen, +120ms is outside the Ok window")

        // With widenMs=15, Ok = 125ms → the same onset now grades (Ok).
        let scheduler2 = ManualDeferredScheduler()
        let widened = percussionScorer(
            [ExpectedEvent(eventIndex: 0, timestamp: 1.0)],
            widenMs: 15,
            scheduler: scheduler2
        )
        widened.ingest(onset(relative: 1.12))
        widened.finish(actualDurationSeconds: 2.0)
        XCTAssertEqual(widened.finalResults[0].grade, .ok, "widen brings +120ms inside the widened Ok window")
    }

    // MARK: - Tentative-miss loop index tracking

    func testTentativeMissLoopAdvancesAndBreaks() {
        let scheduler = ManualDeferredScheduler()
        let events = (0..<4).map { ExpectedEvent(eventIndex: $0, timestamp: Double($0) + 1.0) }
        let scorer = percussionScorer(events, scheduler: scheduler)
        let okWindow = (toleranceByDifficulty[.beginner]!.ok + 200) / 1000

        // Clock only past e0 + e1 windows: only those two become tentative misses; e2/e3 untouched.
        scorer.checkTentativeMisses(elapsedSeconds: 2.0 + okWindow + 0.01)
        XCTAssertEqual(scorer.snapshot.results.map(\.eventIndex).sorted(), [0, 1])

        // Idempotent re-check at the same clock adds nothing new.
        scorer.checkTentativeMisses(elapsedSeconds: 2.0 + okWindow + 0.01)
        XCTAssertEqual(scorer.snapshot.results.count, 2)

        // Advance further → the rest become misses; combo stays reset.
        scorer.checkTentativeMisses(elapsedSeconds: 4.0 + okWindow + 0.01)
        XCTAssertEqual(scorer.snapshot.results.count, 4)
        XCTAssertEqual(scorer.snapshot.combo, 0)
    }

    // MARK: - Live HUD readouts

    func testLiveComboAndScoreUpdateOnHitsAndMiss() {
        let scheduler = ManualDeferredScheduler()
        let events = (0..<3).map { ExpectedEvent(eventIndex: $0, timestamp: Double($0) + 1.0) }
        let scorer = percussionScorer(events, scheduler: scheduler)

        scorer.ingest(onset(relative: 1.0))
        XCTAssertEqual(scorer.currentCombo, 1)
        scorer.ingest(onset(relative: 2.0))
        XCTAssertEqual(scorer.currentCombo, 2)
        XCTAssertEqual(scorer.currentScore, 100, accuracy: 0.01)
        XCTAssertEqual(scorer.lastHitGrade, "perfect")

        // A tentative miss resets the live combo.
        let okWindow = (toleranceByDifficulty[.beginner]!.ok + 200) / 1000
        scorer.checkTentativeMisses(elapsedSeconds: 3.0 + okWindow + 0.01)
        XCTAssertEqual(scorer.currentCombo, 0)
        XCTAssertEqual(scorer.lastHitGrade, "miss")
    }

    func testFinishIsIdempotent() {
        let scheduler = ManualDeferredScheduler()
        let scorer = percussionScorer([ExpectedEvent(eventIndex: 0, timestamp: 1.0)], scheduler: scheduler)
        scorer.ingest(onset(relative: 1.0))
        let first = scorer.finish(actualDurationSeconds: 2.0)
        let second = scorer.finish(actualDurationSeconds: 2.0)
        XCTAssertEqual(first, second)
        XCTAssertEqual(scorer.finalResults.count, 1)
    }

    func testIngestAfterFinishIsIgnored() {
        let scheduler = ManualDeferredScheduler()
        let scorer = percussionScorer([ExpectedEvent(eventIndex: 0, timestamp: 1.0)], scheduler: scheduler)
        scorer.finish(actualDurationSeconds: 2.0)
        scorer.ingest(onset(relative: 1.0)) // should be a no-op
        XCTAssertEqual(scorer.finalResults[0].grade, .miss)
    }
}
