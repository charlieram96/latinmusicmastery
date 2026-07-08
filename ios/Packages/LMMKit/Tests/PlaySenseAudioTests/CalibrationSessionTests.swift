import Foundation
import XCTest

@testable import PlaySenseAudio
@testable import PlaySenseCore

/// `CalibrationSession` state-machine transitions, driven entirely by injected `now` readings and
/// synthetic `OnsetEvent`s — no real clock/timer involved, so every transition is deterministic.
final class CalibrationSessionTests: XCTestCase {

    /// t0 = 100 ⇒ countInStart = 100 - 4*0.6 = 97.6, recordStart = 100, beatDuration = 0.6.
    private func makeSession(t0 t0Seconds: Double = 100.0) -> CalibrationSession {
        CalibrationSession(t0: t0Seconds, routeKey: "route", sourceType: .mic)
    }

    func testIntroBeforeCountInStarts() {
        let session = makeSession()
        session.tick(now: 90.0)
        XCTAssertEqual(session.phase, .intro)
    }

    func testCountingInAdvancesPerBeatAcrossFourBeats() {
        let session = makeSession()

        session.tick(now: 97.6) // first count-in click
        XCTAssertEqual(session.phase, .countingIn(beat: 1))

        session.tick(now: 98.2) // 97.6 + 0.6
        XCTAssertEqual(session.phase, .countingIn(beat: 2))

        session.tick(now: 98.8) // 97.6 + 1.2
        XCTAssertEqual(session.phase, .countingIn(beat: 3))

        session.tick(now: 99.999) // still before recordStart (100)
        XCTAssertEqual(session.phase, .countingIn(beat: 4))
    }

    func testTappingAdvancesPerMeasuredBeat() {
        let session = makeSession()

        session.tick(now: 100.0) // recordStart — first measured beat
        XCTAssertEqual(session.phase, .tapping(beat: 1))

        session.tick(now: 100.6) // second measured beat
        XCTAssertEqual(session.phase, .tapping(beat: 2))

        session.tick(now: 109.5) // 100 + 15*0.6 = 109.0 is beat 16; 109.5 is still within beat 16's window
        XCTAssertEqual(session.phase, .tapping(beat: 16))
    }

    func testResultComputesAfterMeasuredWindowPlusGrace() {
        let session = makeSession()
        session.tick(now: 97.6) // enter .countingIn — recordOnset is a no-op before the session starts

        // 4 clean taps at a known +25ms offset on beats 0-3 (host-seconds = expectedTimes[i] + 0.025).
        for beat in 0..<4 {
            let expectedTime = session.expectedTimes[beat]
            session.recordOnset(OnsetEvent(timestamp: expectedTime + 0.025, energy: 1))
        }

        // recordStart(100) + 16*0.6 = 109.6; + 0.5s grace = 110.1. Before that, still tapping.
        session.tick(now: 110.0)
        XCTAssertEqual(session.phase, .tapping(beat: 16))

        session.tick(now: 110.2)
        guard case let .result(.success(record)) = session.phase else {
            return XCTFail("expected a successful result, got \(session.phase)")
        }
        XCTAssertEqual(record.offsetMs, 25, accuracy: 1e-9)
        XCTAssertEqual(record.iqrMs, 0, accuracy: 1e-9)
        XCTAssertEqual(record.sampleCount, 4)
        XCTAssertEqual(record.routeKey, "route")
        XCTAssertEqual(record.sourceType, .mic)
    }

    func testResultIsTerminalAndIdempotent() {
        let session = makeSession()
        session.tick(now: 97.6) // enter .countingIn — recordOnset is a no-op before the session starts
        for beat in 0..<4 {
            session.recordOnset(OnsetEvent(timestamp: session.expectedTimes[beat] + 0.01, energy: 1))
        }
        session.tick(now: 110.2)
        guard case .result = session.phase else { return XCTFail("expected a result") }

        // Ticking again (even "backwards" in time) must not recompute or change the phase.
        session.tick(now: 50.0)
        guard case let .result(outcome) = session.phase else { return XCTFail("result must stay terminal") }
        guard case let .success(record) = outcome else { return XCTFail("expected success") }
        XCTAssertEqual(record.offsetMs, 10, accuracy: 1e-9)
    }

    func testOnsetsAreIgnoredBeforeCountInAndAfterResult() {
        let session = makeSession()

        // Before the session has started ticking (.intro), taps are ignored.
        session.recordOnset(OnsetEvent(timestamp: 50.0, energy: 1))

        session.tick(now: 97.6) // enter .countingIn
        for beat in 0..<4 {
            session.recordOnset(OnsetEvent(timestamp: session.expectedTimes[beat] + 0.01, energy: 1))
        }
        session.tick(now: 110.2)
        guard case let .result(.success(record)) = session.phase else { return XCTFail("expected success") }
        XCTAssertEqual(record.sampleCount, 4, "the pre-intro onset must not have been recorded")

        // After .result, further taps are also ignored (no observable API to assert on directly, but
        // this must not crash and the phase must remain the same terminal result).
        session.recordOnset(OnsetEvent(timestamp: 200, energy: 1))
        session.tick(now: 200)
        guard case let .result(.success(recordAfter)) = session.phase else { return XCTFail("still success") }
        XCTAssertEqual(recordAfter.sampleCount, 4)
    }

    func testInsufficientTapsProducesFailureResult() {
        let session = makeSession()
        session.tick(now: 97.6) // enter .countingIn — recordOnset is a no-op before the session starts
        // Only 3 taps recorded — below the minimum of 4.
        for beat in 0..<3 {
            session.recordOnset(OnsetEvent(timestamp: session.expectedTimes[beat] + 0.01, energy: 1))
        }
        session.tick(now: 110.2)
        XCTAssertEqual(session.phase, .result(.failure(.notEnoughTaps(detected: 3, minimum: 4))))
    }
}
