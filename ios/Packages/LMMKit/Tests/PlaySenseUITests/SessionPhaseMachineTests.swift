import PlaySenseCore
import XCTest

@testable import PlaySenseUI

/// State-machine transition coverage for the D23 session flow: the happy path, interruption from every
/// active phase, the Bluetooth-blocked path + practice-mode propagation, and the invariant that a
/// disruption in a non-active phase never discards a completed/idle state.
final class SessionPhaseMachineTests: XCTestCase {

    private func stats() -> AttemptStats {
        computeStats(results: [], extraHits: 0, durationSeconds: 1)
    }

    // MARK: - Happy path

    func testForwardFlowIdleToResults() {
        var machine = SessionPhaseMachine()
        XCTAssertEqual(machine.phase, .idle)

        machine.beginModeSelect()
        XCTAssertEqual(machine.phase, .modeSelect)

        machine.selectMode(hasCalibrationRecord: false)
        XCTAssertEqual(machine.phase, .calibrationCheck(hasRecord: false))

        machine.calibrationResolved()
        XCTAssertEqual(machine.phase, .ready)

        machine.requestStart(isBluetoothOutput: false)
        XCTAssertEqual(machine.phase, .countdown(beat: 0))

        machine.updateCountdown(beat: 3)
        XCTAssertEqual(machine.phase, .countdown(beat: 3))

        machine.beginPlaying()
        XCTAssertEqual(machine.phase, .playing)

        let result = stats()
        machine.finish(stats: result)
        XCTAssertEqual(machine.phase, .results(result))
        XCTAssertFalse(machine.isPracticeMode)
    }

    func testSelectModeWithExistingRecordStillGatesThroughCalibrationCheck() {
        var machine = SessionPhaseMachine()
        machine.beginModeSelect()
        machine.selectMode(hasCalibrationRecord: true)
        XCTAssertEqual(machine.phase, .calibrationCheck(hasRecord: true))
        machine.calibrationResolved()
        XCTAssertEqual(machine.phase, .ready)
    }

    // MARK: - Interruption from each active phase

    func testInterruptFromCountdown() {
        var machine = readyMachine()
        machine.requestStart(isBluetoothOutput: false)
        machine.interrupt(.audioInterruption)
        XCTAssertEqual(machine.phase, .interrupted(.audioInterruption))
    }

    func testInterruptFromPlaying() {
        var machine = readyMachine()
        machine.requestStart(isBluetoothOutput: false)
        machine.beginPlaying()
        machine.interrupt(.routeChanged)
        XCTAssertEqual(machine.phase, .interrupted(.routeChanged))
    }

    func testBackgroundingInterruptsActiveTake() {
        var machine = readyMachine()
        machine.requestStart(isBluetoothOutput: false)
        machine.beginPlaying()
        machine.interrupt(.backgrounded)
        XCTAssertEqual(machine.phase, .interrupted(.backgrounded))
    }

    // MARK: - Disruption ignored in non-active phases

    func testInterruptIgnoredInResults() {
        var machine = readyMachine()
        machine.requestStart(isBluetoothOutput: false)
        machine.beginPlaying()
        let result = stats()
        machine.finish(stats: result)
        machine.interrupt(.audioInterruption)
        XCTAssertEqual(machine.phase, .results(result), "a completed attempt is never retroactively discarded")
    }

    func testInterruptIgnoredInReady() {
        var machine = readyMachine()
        machine.interrupt(.audioInterruption)
        XCTAssertEqual(machine.phase, .ready)
    }

    // MARK: - Bluetooth-blocked + practice mode

    func testBluetoothOutputDivertsToBlockingSheet() {
        var machine = readyMachine()
        machine.requestStart(isBluetoothOutput: true)
        XCTAssertEqual(machine.phase, .bluetoothBlocked)
        XCTAssertFalse(machine.isPracticeMode)
    }

    func testPracticeModeEscapeStartsUnrankedTake() {
        var machine = readyMachine()
        machine.requestStart(isBluetoothOutput: true)
        machine.acceptPracticeMode()
        XCTAssertEqual(machine.phase, .countdown(beat: 0))
        XCTAssertTrue(machine.isPracticeMode, "practice mode flags the take unranked")

        // The flag persists through to results.
        machine.beginPlaying()
        machine.finish(stats: stats())
        XCTAssertTrue(machine.isPracticeMode)
    }

    func testDismissBluetoothBlockReturnsToReady() {
        var machine = readyMachine()
        machine.requestStart(isBluetoothOutput: true)
        machine.dismissBluetoothBlock()
        XCTAssertEqual(machine.phase, .ready)
        XCTAssertFalse(machine.isPracticeMode)
    }

    func testAlreadyPracticingSkipsBlockOnRestart() {
        var machine = readyMachine()
        machine.requestStart(isBluetoothOutput: true)
        machine.acceptPracticeMode()
        // Interrupt, retry — retry clears practice mode so the block re-evaluates.
        machine.beginPlaying()
        machine.interrupt(.routeChanged)
        machine.retry()
        XCTAssertEqual(machine.phase, .ready)
        XCTAssertFalse(machine.isPracticeMode, "retry re-evaluates the route from scratch")
    }

    // MARK: - Retry / reset

    func testRetryFromResults() {
        var machine = readyMachine()
        machine.requestStart(isBluetoothOutput: false)
        machine.beginPlaying()
        machine.finish(stats: stats())
        machine.retry()
        XCTAssertEqual(machine.phase, .ready)
    }

    func testResetReturnsToIdle() {
        var machine = readyMachine()
        machine.requestStart(isBluetoothOutput: false)
        machine.beginPlaying()
        machine.reset()
        XCTAssertEqual(machine.phase, .idle)
    }

    // MARK: - Helpers

    private func readyMachine() -> SessionPhaseMachine {
        var machine = SessionPhaseMachine()
        machine.beginModeSelect()
        machine.selectMode(hasCalibrationRecord: true)
        machine.calibrationResolved()
        return machine
    }
}
