import XCTest

@testable import ScoreModel

/// Spot-checks the `Instruments` table against `lib/playsense-studio/instruments.ts` — that
/// module has no dedicated web test suite, so this is fixture-free coverage rather than a
/// case-for-case port.
final class InstrumentsTests: XCTestCase {
    func testTableIsTotalOverEveryInstrumentCase() {
        for instrument in Instrument.allCases {
            XCTAssertNotNil(Instruments.all[instrument], "missing InstrumentConfig for \(instrument)")
        }
    }

    func testGuitarConfigMatchesTS() {
        let guitar = Instruments.config(for: .guitar)
        XCTAssertEqual(guitar.tuning, ["E2", "A2", "D3", "G3", "B3", "E4"])
        XCTAssertEqual(guitar.courseCount, 6)
        XCTAssertEqual(guitar.stringMultiplicity, 1)
        XCTAssertEqual(guitar.fretCount, 22)
        XCTAssertTrue(guitar.fretted)
    }

    func testTresConfigMatchesTS() {
        let tres = Instruments.config(for: .tres)
        XCTAssertEqual(tres.tuning, ["G3", "C4", "E4"])
        XCTAssertEqual(tres.courseCount, 3)
        XCTAssertEqual(tres.stringMultiplicity, 2)
    }

    func testTipleConfigMatchesTS() {
        let tiple = Instruments.config(for: .tiple)
        XCTAssertEqual(tiple.stringMultiplicity, 3)
    }

    func testUnfrettedInstrumentsAreNotFrettedAndHaveNoTuning() {
        for instrument: Instrument in [.piano, .staff, .percKit, .percConga, .percBongo, .percTimbal, .percClave] {
            let config = Instruments.config(for: instrument)
            XCTAssertFalse(config.fretted, "\(instrument) should not be fretted")
            XCTAssertEqual(config.tuning, [])
            XCTAssertEqual(config.stringMultiplicity, 0)
        }
    }

    func testIsFrettedAndTuningConvenienceAccessors() {
        XCTAssertTrue(Instruments.isFretted(.ukulele))
        XCTAssertFalse(Instruments.isFretted(.piano))
        XCTAssertEqual(Instruments.tuning(for: .mandolin), ["G3", "D4", "A4", "E5"])
    }
}
