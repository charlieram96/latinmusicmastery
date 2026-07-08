import Foundation
import XCTest

@testable import PlaySenseCore

/// The first numeric trap from the D19 brief: JS `Math.round` rounds halves toward +∞,
/// Swift's `rounded()` rounds halves away from zero — they disagree on every negative
/// half. Every TS rounding site (`Math.round(x * 100) / 100`, pitch cents, pitch
/// accuracy, `frequencyToMidi`) must go through `jsRound`. The full 100+ case golden
/// sweep lives in `ExerciseUtilsParityTests.testJsRoundMatchesJavaScriptMathRound`; these
/// named cases document the exact disagreement points.
final class JSRoundTests: XCTestCase {
    func testNegativeHalvesRoundTowardPositiveInfinity() {
        // JS: Math.round(-2.5) === -2. Swift's (-2.5).rounded() == -3.
        XCTAssertEqual(jsRound(-2.5), -2)
        XCTAssertEqual(jsRound(-1.5), -1)
        XCTAssertEqual(jsRound(-0.5), 0)
        XCTAssertEqual(jsRound(-100.5), -100)
    }

    func testPositiveHalvesRoundUp() {
        XCTAssertEqual(jsRound(0.5), 1)
        XCTAssertEqual(jsRound(1.5), 2)
        XCTAssertEqual(jsRound(2.5), 3)
        XCTAssertEqual(jsRound(100.5), 101)
    }

    func testTheFamousDoubleJustBelowOneHalfRoundsDown() {
        // 0.49999999999999994 is the largest double < 0.5. A naive `floor(x + 0.5)` port
        // returns 1 here because `x + 0.5` rounds UP to exactly 1.0 — the ES spec (and
        // V8) return 0. The exact-fraction implementation must get this right.
        XCTAssertEqual(jsRound(0.49999999999999994), 0)
        XCTAssertEqual(jsRound(-0.49999999999999994), 0)
    }

    func testIntegersAndLargeValuesPassThrough() {
        XCTAssertEqual(jsRound(0), 0)
        XCTAssertEqual(jsRound(-0.0), 0)
        XCTAssertEqual(jsRound(42), 42)
        XCTAssertEqual(jsRound(1e15 + 0.5), 1e15 + 1)
        XCTAssertEqual(jsRound(-(1e15 + 0.5)), -1e15)
        XCTAssertEqual(jsRound(1e16), 1e16) // beyond 2^52: already integral
    }

    func testSwiftRoundedWouldDisagree() {
        // Regression guard for the trap itself: prove the naive Swift spelling differs,
        // so a future "simplification" to `.rounded()` fails loudly.
        XCTAssertNotEqual((-2.5).rounded(), jsRound(-2.5))
        XCTAssertNotEqual((0.49999999999999994 + 0.5).rounded(.down), jsRound(0.49999999999999994))
    }
}
