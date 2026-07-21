import ScoreModel
import XCTest

@testable import NotationEngraving

/// Rule-matrix coverage for `BeamGrouper` — the VexFlow `generateBeams` default grouping
/// (fixed 1-quarter-note windows, rests/unbeamable break, contiguous runs of ≥2 beamable
/// notes). See `BeamGrouper`'s provenance doc for why the window is a quarter note and not the
/// meter's beat length.
final class BeamGrouperTests: XCTestCase {
    private let fourFour = TimeSignature(numerator: 4, denominator: 4)
    private let threeFour = TimeSignature(numerator: 3, denominator: 4)
    private let sixEight = TimeSignature(numerator: 6, denominator: 8)

    // MARK: Builders

    /// One authored event of a grouper test case.
    private struct Spec {
        let durationQN: Double
        let code: DurationCode
        var rest = false
        var triplet = false
    }

    /// A run of `Spec`s laid end to end from qnStart 0 so windows land on real beat boundaries.
    private func events(_ specs: [Spec]) -> [EventDescriptor] {
        var qnStart = 0.0
        return specs.map { spec in
            let head = spec.rest
                ? []
                : [NoteDescriptor(staffPosition: 0, accidental: nil, midi: 64, isCross: false, keyString: "e/4")]
            let event = EventDescriptor(
                kind: spec.rest ? .rest : .note, qnStart: qnStart, durationQN: spec.durationQN, beatInMeasure: 1,
                durationCode: spec.code, isRest: spec.rest, dotted: false, notes: head, midi: spec.rest ? nil : 64,
                triplet: spec.triplet, tieToNext: false, articulation: nil
            )
            qnStart += spec.durationQN
            return event
        }
    }

    private func eighths(_ count: Int) -> [EventDescriptor] {
        events((0..<count).map { _ in Spec(durationQN: 0.5, code: .eighth) })
    }

    private func groups(_ events: [EventDescriptor], _ timeSignature: TimeSignature) -> [[Int]] {
        BeamGrouper.beamGroups(events: events, timeSignature: timeSignature)
    }

    // MARK: 4/4 all-eighths → four quarter-note groups of two

    func testFourFourEightEighthsGroupInPairs() {
        // VexFlow default window = 1 QN = 2 eighths, so 8 eighths → 4 pairs (NOT one group of 8,
        // NOT two groups of 4). This is the ground-truth the web renders.
        XCTAssertEqual(groups(eighths(8), fourFour), [[0, 1], [2, 3], [4, 5], [6, 7]])
    }

    func testFourFourFourSixteenthsPerBeatGroupWithinTheBeat() {
        // 16 sixteenths in 4/4: each quarter-note window holds four → 4 groups of 4.
        let sixteenths = events((0..<16).map { _ in Spec(durationQN: 0.25, code: .sixteenth) })
        XCTAssertEqual(groups(sixteenths, fourFour), [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]])
    }

    // MARK: Rests break groups

    func testRestBreaksTheBeam() {
        // eighth, eighth-rest, eighth, eighth within one QN window: the rest splits the window,
        // leaving a lone eighth on each side → NO beam (both runs length 1).
        let built = events([
            Spec(durationQN: 0.5, code: .eighth), Spec(durationQN: 0.5, code: .eighth, rest: true),
            Spec(durationQN: 0.5, code: .eighth), Spec(durationQN: 0.5, code: .eighth)
        ])
        // Window 1 [0,1] → rest at 1 breaks → [0] alone (dropped). Window 2 [2,3] → beam.
        XCTAssertEqual(groups(built, fourFour), [[2, 3]])
    }

    // MARK: Quarter (unbeamable) breaks groups

    func testQuarterNoteBreaksAndIsNeverBeamed() {
        // eighth, eighth, quarter, eighth, eighth: the quarter fills its own window and is
        // unbeamable → two eighth-pairs around it.
        let built = events([
            Spec(durationQN: 0.5, code: .eighth), Spec(durationQN: 0.5, code: .eighth),
            Spec(durationQN: 1.0, code: .quarter),
            Spec(durationQN: 0.5, code: .eighth), Spec(durationQN: 0.5, code: .eighth)
        ])
        XCTAssertEqual(groups(built, fourFour), [[0, 1], [3, 4]])
    }

    // MARK: Mixed eighth/sixteenth within a beat beam together

    func testMixedEighthAndSixteenthsBeamAsOneGroupWithinBeat() {
        // eighth + two sixteenths = one QN → one beam group of 3 (secondary beams handled by
        // BeamGeometry, not here).
        let built = events([
            Spec(durationQN: 0.5, code: .eighth),
            Spec(durationQN: 0.25, code: .sixteenth),
            Spec(durationQN: 0.25, code: .sixteenth)
        ])
        XCTAssertEqual(groups(built, fourFour), [[0, 1, 2]])
    }

    // MARK: Single beamable note never beams

    func testLoneEighthDoesNotBeam() {
        // eighth + quarter + quarter + ... : lone eighth in its window → no beam.
        let built = events([
            Spec(durationQN: 0.5, code: .eighth), Spec(durationQN: 0.5, code: .eighth, rest: true),
            Spec(durationQN: 1.0, code: .quarter), Spec(durationQN: 1.0, code: .quarter)
        ])
        XCTAssertEqual(groups(built, fourFour), [])
    }

    // MARK: Chords beam as single columns (one index per event)

    func testChordEventsBeamByEventIndex() {
        // Two eighth CHORDS in one window → one beam group referencing the two event indices
        // (each chord is a single stem column).
        let chordHead = [
            NoteDescriptor(staffPosition: 0, accidental: nil, midi: 64, isCross: false, keyString: "e/4"),
            NoteDescriptor(staffPosition: 2, accidental: nil, midi: 67, isCross: false, keyString: "g/4")
        ]
        let chord = EventDescriptor(
            kind: .chord, qnStart: 0, durationQN: 0.5, beatInMeasure: 1, durationCode: .eighth,
            isRest: false, dotted: false, notes: chordHead, midi: 64,
            triplet: false, tieToNext: false, articulation: nil
        )
        let chord2 = EventDescriptor(
            kind: .chord, qnStart: 0.5, durationQN: 0.5, beatInMeasure: 1.5, durationCode: .eighth,
            isRest: false, dotted: false, notes: chordHead, midi: 64,
            triplet: false, tieToNext: false, articulation: nil
        )
        XCTAssertEqual(groups([chord, chord2], fourFour), [[0, 1]])
    }

    // MARK: Triplet run stays one group

    func testEighthTripletRunBeamsAsOneGroup() {
        // Three eighth-triplet members (durationQN 1/3 each) sum to exactly one QN window → one
        // beam group. This is the documented "triplet run in one beam group" rule.
        let third = 1.0 / 3.0
        let built = events([
            Spec(durationQN: third, code: .eighth, triplet: true),
            Spec(durationQN: third, code: .eighth, triplet: true),
            Spec(durationQN: third, code: .eighth, triplet: true)
        ])
        XCTAssertEqual(groups(built, fourFour), [[0, 1, 2]])
    }

    // MARK: 3/4 grouping

    func testThreeFourEighthsGroupInPairsPerBeat() {
        // 6 eighths in 3/4 → 3 quarter-note windows → 3 pairs.
        XCTAssertEqual(groups(eighths(6), threeFour), [[0, 1], [2, 3], [4, 5]])
    }

    // MARK: 6/8 grouping (VexFlow default = quarter-note windows, not dotted-quarter)

    func testSixEightEighthsGroupByQuarterNoteWindows() {
        // 6 eighths in 6/8: VexFlow's default (1-QN window) groups them in pairs — NOT two
        // groups of three (dotted-quarter beats). Documented as faithful web parity.
        XCTAssertEqual(groups(eighths(6), sixEight), [[0, 1], [2, 3], [4, 5]])
    }
}
