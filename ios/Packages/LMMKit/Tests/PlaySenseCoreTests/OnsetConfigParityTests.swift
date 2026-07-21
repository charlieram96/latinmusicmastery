import Foundation
import XCTest

@testable import PlaySenseCore

/// Golden parity for `onset-config.ts` + `playsense-mappings.ts` + the small string/table
/// helpers: 15 instruments x noisyRoom x speakerSafe, pitch-detection routing, category
/// classification, display labels, and the piezo → surface maps.
final class OnsetConfigParityTests: XCTestCase {
    private static let fixture: OnsetConfigFixture = {
        // swiftlint:disable:next force_try
        try! FixtureLoader.decode(OnsetConfigFixture.self, from: "onset_config.json")
    }()

    func testGetInstrumentConfigParity() {
        let cases = Self.fixture.getInstrumentConfig
        XCTAssertEqual(cases.count, 60, "15 instruments x 2 noisyRoom x 2 speakerSafe")
        var failures: [String] = []
        for testCase in cases {
            let got = getInstrumentConfig(
                testCase.input.instrument,
                noisyRoom: testCase.input.noisyRoom,
                speakerSafe: testCase.input.speakerSafe
            )
            if got != testCase.output {
                failures.append("\(testCase.name):\n  got  \(got)\n  want \(testCase.output)")
            }
        }
        reportParity(failures, total: cases.count, function: "getInstrumentConfig")
    }

    func testInstrumentNeedsPitchDetectionParity() {
        for testCase in Self.fixture.instrumentNeedsPitchDetection {
            XCTAssertEqual(
                instrumentNeedsPitchDetection(testCase.input),
                testCase.output,
                "\(testCase.input)"
            )
        }
    }

    func testGetInstrumentCategoryParity() {
        for testCase in Self.fixture.getInstrumentCategory {
            XCTAssertEqual(getInstrumentCategory(testCase.input), testCase.output, "\(testCase.input)")
        }
    }

    func testGetInstrumentLabelParity() {
        for testCase in Self.fixture.getInstrumentLabel {
            XCTAssertEqual(getInstrumentLabel(testCase.input), testCase.output, testCase.input)
        }
    }

    func testGetPlaySenseMappingParity() {
        for testCase in Self.fixture.getPlaySenseMapping {
            let got = getPlaySenseMapping(testCase.input)
            guard let want = testCase.output else {
                XCTAssertNil(got, testCase.input)
                continue
            }
            let mapping = got
            XCTAssertNotNil(mapping, testCase.input)
            XCTAssertEqual(mapping?.instrument.rawValue, want.instrument, testCase.input)
            XCTAssertEqual(mapping?.useMic, want.useMic, testCase.input)
            let gotPiezo = mapping.map { Dictionary(uniqueKeysWithValues: $0.piezoMap.map { ("\($0.key)", $0.value) }) }
            XCTAssertEqual(gotPiezo, want.piezoMap, testCase.input)
        }
    }
}
