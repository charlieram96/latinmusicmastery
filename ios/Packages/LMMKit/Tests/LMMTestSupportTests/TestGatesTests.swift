import XCTest

@testable import LMMTestSupport

/// D27 tooling fix: `TestGates` replaces 6 scattered `ProcessInfo.environment["RUN_X"] == "1"` checks
/// with one helper that accepts both the bare spelling and the `SIMCTL_CHILD_`-prefixed one. Uses an
/// injected environment dictionary throughout (rather than mutating the real process environment) so
/// these are deterministic and order-independent.
final class TestGatesTests: XCTestCase {
    func testDisabledWhenNeitherSpellingIsSet() {
        XCTAssertFalse(TestGates.isEnabled("RUN_AUDIO_SMOKE", environment: [:]))
    }

    func testEnabledViaBareSpelling() {
        XCTAssertTrue(TestGates.isEnabled("RUN_AUDIO_SMOKE", environment: ["RUN_AUDIO_SMOKE": "1"]))
    }

    func testEnabledViaSimctlChildPrefixedSpelling() {
        XCTAssertTrue(
            TestGates.isEnabled("RUN_AUDIO_SMOKE", environment: ["SIMCTL_CHILD_RUN_AUDIO_SMOKE": "1"])
        )
    }

    func testWrongValueIsNotEnabled() {
        XCTAssertFalse(TestGates.isEnabled("RUN_AUDIO_SMOKE", environment: ["RUN_AUDIO_SMOKE": "true"]))
        XCTAssertFalse(TestGates.isEnabled("RUN_AUDIO_SMOKE", environment: ["RUN_AUDIO_SMOKE": "0"]))
    }

    func testUnrelatedKeysDoNotEnableTheGate() {
        let environment = ["RUN_NOTATION_GOLDENS": "1", "SIMCTL_CHILD_RUN_STAGE_SHOTS": "1"]
        XCTAssertFalse(TestGates.isEnabled("RUN_AUDIO_SMOKE", environment: environment))
    }

    func testBareSpellingTakesPrecedenceWhenBothAreSet() {
        // Documents `value`'s precedence rule rather than asserting behavior a caller depends on today.
        let environment = ["RUN_AUDIO_SMOKE": "1", "SIMCTL_CHILD_RUN_AUDIO_SMOKE": "0"]
        XCTAssertEqual(TestGates.value("RUN_AUDIO_SMOKE", environment: environment), "1")
    }

    func testValueReadsStageShotDirUnderEitherSpelling() {
        XCTAssertEqual(TestGates.value("STAGE_SHOT_DIR", environment: ["STAGE_SHOT_DIR": "/tmp/shots"]), "/tmp/shots")
        XCTAssertEqual(
            TestGates.value("STAGE_SHOT_DIR", environment: ["SIMCTL_CHILD_STAGE_SHOT_DIR": "/tmp/shots"]),
            "/tmp/shots"
        )
        XCTAssertNil(TestGates.value("STAGE_SHOT_DIR", environment: [:]))
    }
}
