import Foundation
import XCTest

@testable import PlaySenseAudio

final class CalibrationStoreTests: XCTestCase {

    private var defaults: UserDefaults!
    private let suiteName = "CalibrationStoreTests.suite"

    override func setUp() {
        super.setUp()
        defaults = UserDefaults(suiteName: suiteName)
        defaults.removePersistentDomain(forName: suiteName)
    }

    override func tearDown() {
        defaults.removePersistentDomain(forName: suiteName)
        defaults = nil
        super.tearDown()
    }

    private func route(inputName: String, outputName: String) -> RouteInfo {
        RouteInfo(
            inputs: [RoutePortInfo(portType: "Built-In", portName: inputName)],
            outputs: [RoutePortInfo(portType: "Built-In", portName: outputName)]
        )
    }

    // MARK: - Keying

    func testRouteKeyDeterministicForSameRoute() {
        let routeA = route(inputName: "iPhone Microphone", outputName: "iPhone Speaker")
        let routeAAgain = route(inputName: "iPhone Microphone", outputName: "iPhone Speaker")
        XCTAssertEqual(CalibrationStore.routeKey(for: routeA), CalibrationStore.routeKey(for: routeAAgain))
    }

    func testRouteKeyDiffersForDifferentRoutes() {
        let mic = route(inputName: "iPhone Microphone", outputName: "iPhone Speaker")
        let headphones = route(inputName: "iPhone Microphone", outputName: "Wired Headphones")
        XCTAssertNotEqual(CalibrationStore.routeKey(for: mic), CalibrationStore.routeKey(for: headphones))
    }

    // MARK: - Save / load

    func testSaveThenLoadRoundTrips() {
        let record = CalibrationRecord(
            offsetMs: 42.5, iqrMs: 8, widenMs: 0, sampleCount: 6,
            date: Date(timeIntervalSince1970: 1_700_000_000),
            routeKey: "route-a", sourceType: .mic
        )
        CalibrationStore.save(record, defaults: defaults)

        let loaded = CalibrationStore.load(sourceType: .mic, routeKey: "route-a", defaults: defaults)
        XCTAssertEqual(loaded, record)
    }

    func testLoadReturnsNilWhenNothingStored() {
        XCTAssertNil(CalibrationStore.load(sourceType: .mic, routeKey: "never-stored", defaults: defaults))
    }

    func testMicAndBleAreStoredIndependentlyForSameRouteKey() {
        let micRecord = CalibrationRecord(
            offsetMs: 10, iqrMs: 0, widenMs: 0, sampleCount: 4, date: Date(), routeKey: "shared", sourceType: .mic
        )
        let bleRecord = CalibrationRecord(
            offsetMs: 20, iqrMs: 0, widenMs: 0, sampleCount: 4, date: Date(), routeKey: "shared", sourceType: .ble
        )
        CalibrationStore.save(micRecord, defaults: defaults)
        CalibrationStore.save(bleRecord, defaults: defaults)

        XCTAssertEqual(CalibrationStore.load(sourceType: .mic, routeKey: "shared", defaults: defaults)?.offsetMs, 10)
        XCTAssertEqual(CalibrationStore.load(sourceType: .ble, routeKey: "shared", defaults: defaults)?.offsetMs, 20)
    }

    // MARK: - Route-change invalidation

    func testEffectiveCalibrationFallsBackToSeedWhenRouteChanges() {
        let originalRoute = route(inputName: "iPhone Microphone", outputName: "iPhone Speaker")
        let originalKey = CalibrationStore.routeKey(for: originalRoute)
        let stored = CalibrationRecord(
            offsetMs: 55, iqrMs: 5, widenMs: 0, sampleCount: 5, date: Date(),
            routeKey: originalKey, sourceType: .mic
        )
        CalibrationStore.save(stored, defaults: defaults)

        // Same route → the stored tap-along calibration is used.
        let sameRouteResult = CalibrationStore.effectiveCalibration(
            sourceType: .mic, route: originalRoute,
            inputLatency: 0.005, outputLatency: 0.005, ioBufferDuration: 0.005,
            defaults: defaults
        )
        XCTAssertEqual(sameRouteResult, stored)

        // Route changes (e.g. headphones plugged in) → a DIFFERENT key, so the old record isn't found;
        // this IS the "invalidation" — no explicit invalidation step exists or is needed.
        let newRoute = route(inputName: "iPhone Microphone", outputName: "Wired Headphones")
        let newRouteResult = CalibrationStore.effectiveCalibration(
            sourceType: .mic, route: newRoute,
            inputLatency: 0.006, outputLatency: 0.002, ioBufferDuration: 0.001,
            defaults: defaults
        )
        XCTAssertNotEqual(newRouteResult.offsetMs, stored.offsetMs)
        XCTAssertEqual(newRouteResult.sampleCount, 0, "a seeded (not measured) record has sampleCount 0")
        XCTAssertEqual(newRouteResult.routeKey, CalibrationStore.routeKey(for: newRoute))
    }

    // MARK: - Seeded default

    func testSeedFromSessionLatenciesSumsAndConvertsToMilliseconds() {
        let seeded = CalibrationStore.seedFromSessionLatencies(
            inputLatency: 0.010, outputLatency: 0.008, ioBufferDuration: 0.005,
            routeKey: "route-x", sourceType: .mic
        )
        // (0.010 + 0.008 + 0.005) * 1000 = 23ms.
        XCTAssertEqual(seeded.offsetMs, 23, accuracy: 1e-6)
        XCTAssertEqual(seeded.iqrMs, 0)
        XCTAssertEqual(seeded.widenMs, 0)
        XCTAssertEqual(seeded.sampleCount, 0)
        XCTAssertEqual(seeded.routeKey, "route-x")
        XCTAssertEqual(seeded.sourceType, .mic)
    }

    func testEffectiveCalibrationSeedsWhenNoRecordExists() {
        let newRoute = route(inputName: "iPhone Microphone", outputName: "iPhone Speaker")
        let result = CalibrationStore.effectiveCalibration(
            sourceType: .mic, route: newRoute,
            inputLatency: 0.004, outputLatency: 0.004, ioBufferDuration: 0.002,
            defaults: defaults
        )
        XCTAssertEqual(result.offsetMs, 10, accuracy: 1e-6) // (0.004+0.004+0.002)*1000
        XCTAssertEqual(result.sampleCount, 0)
    }

    // MARK: - Debug listing / clear

    func testAllRecordsAndClearAll() {
        let recordA = CalibrationRecord(
            offsetMs: 1, iqrMs: 0, widenMs: 0, sampleCount: 4, date: Date(), routeKey: "a", sourceType: .mic
        )
        let recordB = CalibrationRecord(
            offsetMs: 2, iqrMs: 0, widenMs: 0, sampleCount: 4, date: Date(), routeKey: "b", sourceType: .ble
        )
        CalibrationStore.save(recordA, defaults: defaults)
        CalibrationStore.save(recordB, defaults: defaults)

        let all = CalibrationStore.allRecords(defaults: defaults)
        XCTAssertEqual(Set(all.map(\.routeKey)), Set(["a", "b"]))

        CalibrationStore.clearAll(defaults: defaults)
        XCTAssertTrue(CalibrationStore.allRecords(defaults: defaults).isEmpty)
    }

    func testClearRemovesOnlyTheSpecifiedRecord() {
        let recordA = CalibrationRecord(
            offsetMs: 1, iqrMs: 0, widenMs: 0, sampleCount: 4, date: Date(), routeKey: "a", sourceType: .mic
        )
        let recordB = CalibrationRecord(
            offsetMs: 2, iqrMs: 0, widenMs: 0, sampleCount: 4, date: Date(), routeKey: "b", sourceType: .mic
        )
        CalibrationStore.save(recordA, defaults: defaults)
        CalibrationStore.save(recordB, defaults: defaults)

        CalibrationStore.clear(sourceType: .mic, routeKey: "a", defaults: defaults)

        XCTAssertNil(CalibrationStore.load(sourceType: .mic, routeKey: "a", defaults: defaults))
        XCTAssertNotNil(CalibrationStore.load(sourceType: .mic, routeKey: "b", defaults: defaults))
    }

    // MARK: - Schema versioning

    func testNewRecordsStampTheCurrentSchemaVersionAndRoundTrip() {
        let record = CalibrationRecord(
            offsetMs: 1, iqrMs: 0, widenMs: 0, sampleCount: 4, date: Date(), routeKey: "r", sourceType: .mic
        )
        XCTAssertEqual(record.schemaVersion, CalibrationRecord.currentSchemaVersion)
        XCTAssertEqual(record.schemaVersion, 1)

        CalibrationStore.save(record, defaults: defaults)
        let loaded = CalibrationStore.load(sourceType: .mic, routeKey: "r", defaults: defaults)
        XCTAssertEqual(loaded?.schemaVersion, 1)
    }

    func testLegacyRecordWithNoSchemaVersionKeyDecodesAsVersion1() {
        // A record persisted BEFORE `schemaVersion` existed has no such key in its JSON at all —
        // reconstruct that exact pre-fix shape by hand rather than relying on `CalibrationRecord`'s
        // (post-fix) encoder, which now always includes the key.
        let key = CalibrationStore.storageKey(sourceType: .mic, routeKey: "legacy-route")
        let legacyJSON = """
        {"offsetMs":12.5,"iqrMs":3,"widenMs":0,"sampleCount":5,
        "date":700000000,"routeKey":"legacy-route","sourceType":"mic"}
        """
        defaults.set(Data(legacyJSON.utf8), forKey: key)

        let loaded = CalibrationStore.load(sourceType: .mic, routeKey: "legacy-route", defaults: defaults)
        XCTAssertEqual(loaded?.schemaVersion, 1, "a missing schemaVersion key must be treated as legacy v1")
        XCTAssertEqual(loaded?.offsetMs, 12.5)
        XCTAssertEqual(loaded?.routeKey, "legacy-route")
    }

    // MARK: - Decode-fallback cleanup of unreadable blobs

    func testUnreadableBlobIsRemovedByLoadNotJustSkipped() {
        let key = CalibrationStore.storageKey(sourceType: .mic, routeKey: "corrupt-route")
        defaults.set(Data([0xFF, 0x00, 0x01, 0x02]), forKey: key)

        XCTAssertNil(CalibrationStore.load(sourceType: .mic, routeKey: "corrupt-route", defaults: defaults))
        XCTAssertNil(defaults.data(forKey: key), "an unreadable blob must be cleaned up, not left dangling")
    }

    func testUnreadableBlobIsRemovedByAllRecordsButGoodRecordsSurvive() {
        let goodRecord = CalibrationRecord(
            offsetMs: 5, iqrMs: 0, widenMs: 0, sampleCount: 4, date: Date(), routeKey: "good-route", sourceType: .mic
        )
        CalibrationStore.save(goodRecord, defaults: defaults)
        let badKey = CalibrationStore.storageKey(sourceType: .ble, routeKey: "corrupt-route")
        defaults.set(Data([0xDE, 0xAD, 0xBE, 0xEF]), forKey: badKey)

        let all = CalibrationStore.allRecords(defaults: defaults)

        XCTAssertEqual(all.map(\.routeKey), ["good-route"])
        XCTAssertNil(defaults.data(forKey: badKey), "the corrupt blob must be cleaned up during allRecords()")
    }
}
