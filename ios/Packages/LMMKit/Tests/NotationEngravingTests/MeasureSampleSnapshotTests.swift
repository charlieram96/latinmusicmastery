import ScoreModel
import SnapshotTesting
import UIKit
import XCTest

@testable import NotationEngraving

/// End-to-end C14 proof: lay out and engrave one real measure from a corpus `ScoreDocument`
/// fixture — a percussion measure (conga tumbao) and a pitched measure (C-major scale) — at two
/// staff sizes, in light and dark ink. This exercises `EventDescriptorBuilder` +
/// `MeasureLayoutEngine` + `GlyphMetrics`/`BravuraFont` together, rendered through
/// `UIGraphicsImageRenderer` (the target's only UIKit touch — the draw path itself is CG/CT).
final class MeasureSampleSnapshotTests: XCTestCase {
    private let smallScale = ScaleContext(staffSpacePoints: 10)
    private let largeScale = ScaleContext(staffSpacePoints: 16)

    private let conga = "conga_tumbao_fixture.json"
    private let guitar = "guitar_lick_fixture.json"

    // MARK: Percussion (conga tumbao, measure 1)

    func testCongaMeasureSmallLight() throws {
        try assertMeasure(fixture: conga, scale: smallScale, color: .lightDefault)
    }

    func testCongaMeasureSmallDark() throws {
        try assertMeasure(fixture: conga, scale: smallScale, color: .darkDefault)
    }

    func testCongaMeasureLargeLight() throws {
        try assertMeasure(fixture: conga, scale: largeScale, color: .lightDefault)
    }

    /// C15 carry-forward: the large/dark conga variant was missing (only Small/Dark and
    /// Large/Light existed), leaving the beamed-eighths percussion measure un-covered at the
    /// large size in dark ink — recorded here for parity with the other three combinations.
    func testCongaMeasureLargeDark() throws {
        try assertMeasure(fixture: conga, scale: largeScale, color: .darkDefault)
    }

    // MARK: Pitched (C-major scale, measure 1)

    func testGuitarMeasureSmallLight() throws {
        try assertMeasure(fixture: guitar, scale: smallScale, color: .lightDefault)
    }

    func testGuitarMeasureSmallDark() throws {
        try assertMeasure(fixture: guitar, scale: smallScale, color: .darkDefault)
    }

    func testGuitarMeasureLargeLight() throws {
        try assertMeasure(fixture: guitar, scale: largeScale, color: .lightDefault)
    }

    // MARK: Rhythm-rich synthetic measure (C15: beams, secondary stubs, triplet, tie)

    func testRhythmMeasureSmallLight() {
        assertRhythmMeasure(scale: smallScale, color: .lightDefault)
    }

    func testRhythmMeasureSmallDark() {
        assertRhythmMeasure(scale: smallScale, color: .darkDefault)
    }

    func testRhythmMeasureLargeLight() {
        assertRhythmMeasure(scale: largeScale, color: .lightDefault)
    }

    func testRhythmMeasureLargeDark() {
        assertRhythmMeasure(scale: largeScale, color: .darkDefault)
    }

    private func assertRhythmMeasure(
        scale: ScaleContext,
        color: NotationColor,
        file: StaticString = #file,
        testName: String = #function,
        line: UInt = #line
    ) {
        let background: UIColor = color == .lightDefault ? .white : .black
        let context = MeasureContext(
            clef: .treble, timeSignature: TimeSignature(numerator: 4, denominator: 4),
            showClef: true, showTimeSignature: true
        )
        let space = scale.staffSpacePoints
        let origin = CGPoint(x: space * 1.5, y: space * 5)
        let frame = MeasureLayoutEngine.layout(
            events: rhythmRichSampleEvents(), context: context, origin: origin, scale: scale
        )
        let size = CGSize(width: origin.x + frame.width + space * 1.5, height: space * 16)
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { rendererContext in
            let ctx = rendererContext.cgContext
            ctx.setFillColor(background.cgColor)
            ctx.fill(CGRect(origin: .zero, size: size))
            drawMeasureFrame(frame, in: ctx, size: size, notationColor: color)
        }
        assertSnapshot(
            of: image, as: .image(precision: 0.98, perceptualPrecision: 0.97),
            file: file, testName: testName, line: line
        )
    }

    // MARK: Helper

    private func assertMeasure(
        fixture: String,
        scale: ScaleContext,
        color: NotationColor,
        file: StaticString = #file,
        testName: String = #function,
        line: UInt = #line
    ) throws {
        let background: UIColor = color == .lightDefault ? .white : .black
        let document = try ScoreDocument.parse(CorpusFixtureLoader.data(fixture))
        let track = try XCTUnwrap(document.tracks.first)
        let measures = EventDescriptorBuilder.extractTrackEvents(
            track: track,
            initialTimeSignature: document.initialTimeSignature,
            keyFifths: document.initialKeyFifths
        )
        let measure = try XCTUnwrap(measures.first)
        let context = MeasureContext(
            clef: measure.clef,
            timeSignature: measure.timeSignature,
            showClef: true,
            showTimeSignature: true,
            measureStartQN: measure.cumulativeQN
        )

        let space = scale.staffSpacePoints
        let origin = CGPoint(x: space * 1.5, y: space * 4)
        let frame = MeasureLayoutEngine.layout(
            events: measure.events, context: context, origin: origin, scale: scale
        )

        // Canvas: full measure width + margin, with headroom above/below for stems/ledgers.
        let size = CGSize(width: origin.x + frame.width + space * 1.5, height: space * 14)

        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { rendererContext in
            let ctx = rendererContext.cgContext
            ctx.setFillColor(background.cgColor)
            ctx.fill(CGRect(origin: .zero, size: size))
            drawMeasureFrame(frame, in: ctx, size: size, notationColor: color)
        }
        assertSnapshot(
            of: image,
            as: .image(precision: 0.98, perceptualPrecision: 0.97),
            file: file,
            testName: testName,
            line: line
        )
    }
}
