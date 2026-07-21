import PlaySenseCore
import XCTest

@testable import PlaySenseBLE

@MainActor
final class BLEOnsetSourceTests: XCTestCase {

    private func makeSource(instrument: Instrument?) -> BLEOnsetSource {
        BLEOnsetSource(deviceManager: PlaySenseDeviceManager(central: FakeCentralManager()), instrument: instrument)
    }

    // MARK: - Congo mapping

    func testCongaMultiPiezoReadingEmitsOneEventPerHitSharingTimestamp() {
        let source = makeSource(instrument: .conga)
        var events: [OnsetEvent] = []
        source.onOnset = { events.append($0) }

        source.handle(PlaySenseBLEReading(piezos: [500, 0, 900]))

        XCTAssertEqual(events.count, 2)
        XCTAssertEqual(events[0].surface, "quinto")
        XCTAssertEqual(events[0].energy, 500)
        XCTAssertEqual(events[1].surface, "tumba")
        XCTAssertEqual(events[1].energy, 900)
        XCTAssertEqual(events[0].timestamp, events[1].timestamp, "one reading → one shared timestamp")
    }

    func testCongaSinglePiezoHitMapsToConga() {
        let source = makeSource(instrument: .conga)
        var events: [OnsetEvent] = []
        source.onOnset = { events.append($0) }

        source.handle(PlaySenseBLEReading(piezos: [0, 300, 0]))

        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].surface, "conga")
    }

    // MARK: - Timbale mapping

    func testTimbaleMappingCoversAllSixSurfaces() {
        let source = makeSource(instrument: .timbale)
        var events: [OnsetEvent] = []
        source.onOnset = { events.append($0) }

        source.handle(PlaySenseBLEReading(piezos: [10, 20, 30, 40, 50, 60]))

        XCTAssertEqual(events.count, 6)
        XCTAssertEqual(events.map(\.surface), ["macho", "hembra", "campana", "cencerro", "jamblock", "cascara"])
    }

    // MARK: - Zero piezos

    func testAllZeroPiezosEmitsNoEvents() {
        let source = makeSource(instrument: .conga)
        var events: [OnsetEvent] = []
        source.onOnset = { events.append($0) }

        source.handle(PlaySenseBLEReading(piezos: [0, 0, 0]))

        XCTAssertTrue(events.isEmpty)
    }

    func testUnmappedPiezoIndexIsIgnored() {
        // Conga only maps indices 0-2; index 5 (a timbale-range channel) has no entry in CONGA_MAPPING.
        let source = makeSource(instrument: .conga)
        var events: [OnsetEvent] = []
        source.onOnset = { events.append($0) }

        source.handle(PlaySenseBLEReading(piezos: [0, 0, 0, 0, 0, 400]))

        XCTAssertTrue(events.isEmpty)
    }

    // MARK: - Calibration path (no instrument → any-hit, no surface)

    func testNilInstrumentEmitsSingleAnyHitEventWithNoSurface() {
        let source = makeSource(instrument: nil)
        var events: [OnsetEvent] = []
        source.onOnset = { events.append($0) }

        source.handle(PlaySenseBLEReading(piezos: [0, 0, 900, 500]))

        XCTAssertEqual(events.count, 1, "calibration path fires once per reading, not once per piezo")
        XCTAssertNil(events[0].surface)
        XCTAssertEqual(events[0].energy, 900, "energy is the max piezo in the reading")
    }

    func testNilInstrumentAllZeroPiezosEmitsNoEvent() {
        let source = makeSource(instrument: nil)
        var events: [OnsetEvent] = []
        source.onOnset = { events.append($0) }

        source.handle(PlaySenseBLEReading(piezos: [0, 0, 0]))

        XCTAssertTrue(events.isEmpty)
    }

    // MARK: - Input level (throttled maxPiezo/4095 meter)

    func testFirstReadingPublishesInputLevelImmediately() {
        let source = makeSource(instrument: .conga)
        var levels: [Double] = []
        source.onInputLevel = { levels.append($0) }

        source.handle(PlaySenseBLEReading(piezos: [4095, 0, 0]))

        XCTAssertEqual(levels, [1.0])
    }

    func testInputLevelIsMaxPiezoOverFullScaleClampedToOne() {
        let source = makeSource(instrument: .conga)
        var levels: [Double] = []
        source.onInputLevel = { levels.append($0) }

        source.handle(PlaySenseBLEReading(piezos: [2047.5, 0, 0])) // half of 4095

        XCTAssertEqual(levels.count, 1)
        XCTAssertEqual(levels.first ?? -1, 0.5, accuracy: 0.0001)
    }

    func testBackToBackReadingsThrottleInputLevelUpdates() {
        let source = makeSource(instrument: .conga)
        var levels: [Double] = []
        source.onInputLevel = { levels.append($0) }

        source.handle(PlaySenseBLEReading(piezos: [1000, 0, 0]))
        source.handle(PlaySenseBLEReading(piezos: [2000, 0, 0])) // fires microseconds later — throttled

        XCTAssertEqual(levels.count, 1, "second call lands well within the ~33ms throttle window")
    }

    // MARK: - start()/stop() wiring

    func testStartSubscribesToDeviceManagerReadingsAndStopUnsubscribes() {
        let manager = PlaySenseDeviceManager(central: FakeCentralManager())
        let source = BLEOnsetSource(deviceManager: manager, instrument: .conga)
        var events: [OnsetEvent] = []
        source.onOnset = { events.append($0) }

        XCTAssertNil(manager.onReading)
        source.start()
        XCTAssertNotNil(manager.onReading)

        manager.onReading?(PlaySenseBLEReading(piezos: [500, 0, 0]))
        XCTAssertEqual(events.count, 1)

        source.stop()
        XCTAssertNil(manager.onReading, "stop() unsubscribes without tearing down the BLE connection itself")
    }

    #if DEBUG
    func testDebugInjectRoutesThroughTheRealHandlePath() {
        let source = makeSource(instrument: .timbale)
        var events: [OnsetEvent] = []
        source.onOnset = { events.append($0) }

        source.debugInject(reading: PlaySenseBLEReading(piezos: [0, 0, 700]))

        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(events[0].surface, "campana")
    }
    #endif
}
