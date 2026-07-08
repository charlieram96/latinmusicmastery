import Foundation
import XCTest

@testable import PlaySenseCore

/// Direct assertions on the ported constant tables (`types.ts`, `playsense-mappings.ts`) —
/// the values the D19 brief calls out explicitly, pinned in source form as well as via the
/// golden fixtures.
final class StaticDataTests: XCTestCase {
    func testToleranceWindowsByDifficulty() {
        XCTAssertEqual(toleranceByDifficulty[.beginner], ToleranceWindows(perfect: 40, good: 70, ok: 110))
        XCTAssertEqual(toleranceByDifficulty[.intermediate], ToleranceWindows(perfect: 30, good: 55, ok: 85))
        XCTAssertEqual(toleranceByDifficulty[.advanced], ToleranceWindows(perfect: 20, good: 40, ok: 65))
    }

    func testPitchToleranceCents() {
        XCTAssertEqual(pitchToleranceCents[.beginner], 80)
        XCTAssertEqual(pitchToleranceCents[.intermediate], 55)
        XCTAssertEqual(pitchToleranceCents[.advanced], 35)
    }

    func testPitchOctaveAgnostic() {
        XCTAssertEqual(pitchOctaveAgnostic[.beginner], true)
        XCTAssertEqual(pitchOctaveAgnostic[.intermediate], true)
        XCTAssertEqual(pitchOctaveAgnostic[.advanced], false)
    }

    func testChordPresenceRatio() {
        XCTAssertEqual(chordPresenceRatio[.beginner], 0.66)
        XCTAssertEqual(chordPresenceRatio[.intermediate], 0.8)
        XCTAssertEqual(chordPresenceRatio[.advanced], 1.0)
    }

    func testChromaPresenceThreshold() {
        XCTAssertEqual(chromaPresenceThreshold, 0.35)
    }

    func testGradePoints() {
        XCTAssertEqual(gradePoints[.perfect], 100)
        XCTAssertEqual(gradePoints[.good], 70)
        XCTAssertEqual(gradePoints[.ok], 40)
        XCTAssertEqual(gradePoints[.miss], 0)
    }

    func testGradeColors() {
        XCTAssertEqual(gradeColors[.perfect], "#22c55e")
        XCTAssertEqual(gradeColors[.good], "#eab308")
        XCTAssertEqual(gradeColors[.ok], "#f97316")
        XCTAssertEqual(gradeColors[.miss], "#ef4444")
    }

    func testCongaMapping() {
        XCTAssertEqual(congaMapping.instrument, .conga)
        XCTAssertEqual(congaMapping.piezoMap, [0: "quinto", 1: "conga", 2: "tumba"])
        XCTAssertTrue(congaMapping.useMic)
    }

    func testTimbaleMapping() {
        XCTAssertEqual(timbaleMapping.instrument, .timbale)
        XCTAssertEqual(
            timbaleMapping.piezoMap,
            [0: "macho", 1: "hembra", 2: "campana", 3: "cencerro", 4: "jamblock", 5: "cascara"]
        )
        XCTAssertFalse(timbaleMapping.useMic)
    }

    func testPlaySenseInstrumentSupport() {
        XCTAssertEqual(playSenseInstruments, ["conga", "congas", "timbale", "timbales"])
        XCTAssertEqual(getPlaySenseMapping("congas")?.instrument, .conga)
        XCTAssertEqual(getPlaySenseMapping("timbales")?.instrument, .timbale)
        XCTAssertNil(getPlaySenseMapping("guitar"))
    }

    func testInstrumentCategorySplit() {
        let percussion: [PlaySenseCore.Instrument] = [.conga, .timbale, .bongo, .clave, .cowbell, .guiro]
        for instrument in PlaySenseCore.Instrument.allCases {
            let expected: InstrumentCategory = percussion.contains(instrument) ? .percussion : .pitched
            XCTAssertEqual(getInstrumentCategory(instrument), expected, "\(instrument)")
        }
    }
}
