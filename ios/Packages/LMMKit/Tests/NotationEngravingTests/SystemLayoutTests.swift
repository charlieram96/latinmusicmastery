import CoreGraphics
import Foundation
import ScoreModel
import XCTest

@testable import NotationEngraving

/// C16 unit tests for the pure `SystemLayout` engine: scroll cumulative geometry, wrapped
/// reflow (measures-per-row / system count / header placement / y-stacking), and score-level
/// `ScoreNoteAnchor` integrity (monotonic qn, tempo-walked ms, per-system framing, count).
final class SystemLayoutTests: XCTestCase {
    private let scale = ScaleContext(staffSpacePoints: 8)

    // MARK: Fixtures

    /// A pitched track of `count` 4/4 measures, each four mid-staff quarter notes (C4 E4 G4 B4).
    private func quarterNoteDocument(measureCount: Int) -> ScoreDocument {
        let midis = [60, 64, 67, 71]
        let measures = (1...measureCount).map { number -> Measure in
            let events: [MusicalEvent] = midis.map { .note(Note(durationQN: 1, midi: $0)) }
            return Measure(number: number, voices: [Voice(number: 1, events: events)])
        }
        let track = Track(
            index: 0, instrument: .guitar, displayName: "Guitar", tuning: nil,
            stringMultiplicity: 1, channel: 0, defaultView: .staff, measures: measures
        )
        return ScoreDocument(
            title: "Quarters", sourceFormat: .native, initialTempo: 120,
            initialTimeSignature: TimeSignature(numerator: 4, denominator: 4),
            initialKeyFifths: 0, tracks: [track]
        )
    }

    private func descriptors(_ document: ScoreDocument) -> [MeasureDescriptor] {
        EventDescriptorBuilder.extractTrackEvents(
            track: document.tracks[0],
            initialTimeSignature: document.initialTimeSignature,
            keyFifths: document.initialKeyFifths
        )
    }

    // MARK: Scroll mode

    func testScrollIsOneSystemWithCumulativeX() {
        let document = quarterNoteDocument(measureCount: 5)
        let layout = SystemLayout.layout(
            measures: descriptors(document), availableWidth: 400, mode: .scroll, scale: scale
        )
        XCTAssertEqual(layout.systems.count, 1)
        let measures = layout.systems[0].measures
        XCTAssertEqual(measures.count, 5)

        // Uniform width; each measure's originX is the previous one's right edge (contiguous).
        let width = measures[0].width
        for pair in zip(measures, measures.dropFirst()) {
            XCTAssertEqual(pair.0.width, width, accuracy: 0.01)
            XCTAssertEqual(pair.1.originX, pair.0.originX + pair.0.width, accuracy: 0.01)
        }
        // Total width ≈ left pad + N·width + right pad.
        let pad = scale.points(SystemLayoutMetrics.horizontalPaddingSpaces)
        XCTAssertEqual(layout.totalSize.width, pad * 2 + width * 5, accuracy: 0.5)
        XCTAssertEqual(layout.mode, .scroll)
    }

    func testScrollHeaderOnlyOnFirstMeasure() {
        let document = quarterNoteDocument(measureCount: 4)
        let layout = SystemLayout.layout(
            measures: descriptors(document), availableWidth: 400, mode: .scroll, scale: scale
        )
        let measures = layout.systems[0].measures
        XCTAssertNotNil(measures[0].clef)
        XCTAssertFalse(measures[0].timeSignature.isEmpty)
        for measure in measures.dropFirst() {
            XCTAssertNil(measure.clef)
            XCTAssertTrue(measure.timeSignature.isEmpty)
        }
    }

    // MARK: Wrapped reflow

    /// Measures-per-row and system count grow/shrink monotonically with width. At `space = 8` a
    /// 4/4 bar's natural width is 36·8 = 288 pt, so with ~1.2·2 spaces of inset the row packs
    /// `floor(usable / 288)` bars: iPhone → 1, iPad 744 → 2, iPad 1024 → 3.
    func testWrappedMeasuresPerRowReflowsWithWidth() {
        let document = quarterNoteDocument(measureCount: 8)
        let measures = descriptors(document)

        func perRowAndSystems(width: CGFloat) -> (perRow: Int, systems: Int) {
            let layout = SystemLayout.layout(measures: measures, availableWidth: width, mode: .wrapped, scale: scale)
            return (layout.systems[0].measures.count, layout.systems.count)
        }

        let iphone = perRowAndSystems(width: 390)
        let ipadNarrow = perRowAndSystems(width: 744)
        let ipadWide = perRowAndSystems(width: 1024)

        XCTAssertEqual(iphone.perRow, 1)
        XCTAssertEqual(iphone.systems, 8)
        XCTAssertEqual(ipadNarrow.perRow, 2)
        XCTAssertEqual(ipadNarrow.systems, 4)
        XCTAssertEqual(ipadWide.perRow, 3)
        XCTAssertEqual(ipadWide.systems, 3)

        // Monotonic: wider never packs fewer per row nor more systems.
        XCTAssertLessThanOrEqual(iphone.perRow, ipadNarrow.perRow)
        XCTAssertLessThanOrEqual(ipadNarrow.perRow, ipadWide.perRow)
        XCTAssertGreaterThanOrEqual(iphone.systems, ipadNarrow.systems)
        XCTAssertGreaterThanOrEqual(ipadNarrow.systems, ipadWide.systems)
    }

    /// Web-reality (documented): the clef + time-signature lead-in is drawn ONLY on the first
    /// measure of the whole score (`showHeader === i === 0`), NOT on the first measure of every
    /// system — so later systems' leading measures carry no clef.
    func testWrappedHeaderOnlyOnScoreFirstMeasure() {
        let document = quarterNoteDocument(measureCount: 6)
        let layout = SystemLayout.layout(
            measures: descriptors(document), availableWidth: 744, mode: .wrapped, scale: scale
        )
        XCTAssertGreaterThanOrEqual(layout.systems.count, 2)
        XCTAssertNotNil(layout.systems[0].measures[0].clef)
        // Every other measure — including the first of system 1 — has no clef/time-sig.
        for (systemIndex, system) in layout.systems.enumerated() {
            for (measureIndex, measure) in system.measures.enumerated() where !(systemIndex == 0 && measureIndex == 0) {
                XCTAssertNil(measure.clef, "system \(systemIndex) measure \(measureIndex) should have no clef")
                XCTAssertTrue(measure.timeSignature.isEmpty)
            }
        }
    }

    func testWrappedSystemsStackByPitchConstant() {
        let document = quarterNoteDocument(measureCount: 6)
        let layout = SystemLayout.layout(
            measures: descriptors(document), availableWidth: 744, mode: .wrapped, scale: scale
        )
        let topMargin = scale.points(SystemLayoutMetrics.topMarginSpaces)
        let pitch = scale.points(SystemLayoutMetrics.systemPitchSpaces)
        for (index, system) in layout.systems.enumerated() {
            XCTAssertEqual(system.index, index)
            XCTAssertEqual(system.topLineY, topMargin + CGFloat(index) * pitch, accuracy: 0.01)
        }
        // Bands tile downward without a vertical gap larger than the pitch, and never overlap
        // their neighbour's staff line.
        for pair in zip(layout.systems, layout.systems.dropFirst()) {
            XCTAssertGreaterThan(pair.1.topLineY, pair.0.topLineY)
        }
    }

    func testWrappedRowsAreJustifiedToFillWidth() {
        let document = quarterNoteDocument(measureCount: 4)
        let width: CGFloat = 744
        let layout = SystemLayout.layout(
            measures: descriptors(document), availableWidth: width, mode: .wrapped, scale: scale
        )
        let pad = scale.points(SystemLayoutMetrics.horizontalPaddingSpaces)
        for system in layout.systems {
            let right = (system.measures.last?.originX ?? 0) + (system.measures.last?.width ?? 0)
            XCTAssertEqual(right, width - pad, accuracy: 0.5, "each row should stretch to fill the usable width")
        }
    }

    // MARK: Anchor integrity

    func testAnchorsCountMonotonicAndFramed() {
        let document = quarterNoteDocument(measureCount: 6)
        let measures = descriptors(document)
        let expectedEvents = measures.reduce(0) { $0 + $1.events.count }
        let layout = SystemLayout.layout(measures: measures, availableWidth: 744, mode: .wrapped, scale: scale)

        XCTAssertEqual(layout.noteAnchors.count, expectedEvents)

        var previousQN = -Double.greatestFiniteMagnitude
        for anchor in layout.noteAnchors {
            XCTAssertGreaterThanOrEqual(anchor.qnStart, previousQN)
            previousQN = anchor.qnStart
            // Anchor lives inside its own system's band.
            let band = layout.systems[anchor.systemIndex].frame
            XCTAssertGreaterThanOrEqual(anchor.frame.midY, band.minY)
            XCTAssertLessThanOrEqual(anchor.frame.midY, band.maxY)
            XCTAssertGreaterThanOrEqual(anchor.frame.midX, band.minX)
            XCTAssertLessThanOrEqual(anchor.frame.midX, band.maxX)
        }
    }

    func testAnchorMsStrictlyIncreasesViaTempoWalk() {
        let document = quarterNoteDocument(measureCount: 5)
        let track = document.tracks[0]
        let layout = SystemLayout.layout(
            measures: descriptors(document), availableWidth: 400, mode: .scroll, scale: scale,
            startMsForQN: { ScoreTime.qnToTrackMs(track: track, score: document, qn: $0) }
        )
        var previousMs = -Double.greatestFiniteMagnitude
        for anchor in layout.noteAnchors {
            XCTAssertGreaterThan(anchor.startMs, previousMs)
            previousMs = anchor.startMs
        }
        // 120 bpm ⇒ 500 ms per quarter; first two quarter notes are 500 ms apart.
        XCTAssertEqual(layout.noteAnchors[1].startMs - layout.noteAnchors[0].startMs, 500, accuracy: 0.01)
    }

    // MARK: Empty

    func testEmptyMeasuresYieldEmptyLayout() {
        let layout = SystemLayout.layout(measures: [], availableWidth: 400, mode: .wrapped, scale: scale)
        XCTAssertTrue(layout.systems.isEmpty)
        XCTAssertTrue(layout.noteAnchors.isEmpty)
        XCTAssertEqual(layout.totalSize, .zero)
    }
}
