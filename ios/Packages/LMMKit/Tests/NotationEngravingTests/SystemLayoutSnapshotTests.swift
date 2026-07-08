import ScoreModel
import SnapshotTesting
import UIKit
import XCTest

@testable import NotationEngraving

/// End-to-end C16 proof: lay out and engrave a whole real-corpus track as SYSTEMS (not a single
/// measure) and render it through `drawScoreLayout` — a wrapped page at an iPhone width and a
/// horizontal scroll strip, in light and dark ink. Exercises `SystemLayout` +
/// `MeasureLayoutEngine` + the drawing path together on one full-canvas surface (the same output
/// the `NotationView` CALayers composite band-by-band).
final class SystemLayoutSnapshotTests: XCTestCase {
    private let scale = ScaleContext(staffSpacePoints: 8)
    private let iPhoneWidth: CGFloat = 390

    // MARK: Pitched (Son Montuno tres — 4 measures)

    func testWrappedPitchedIPhoneLight() throws {
        try assertScore(fixture: "son_montuno_fixture.json", trackIndex: 0, mode: .wrapped, color: .lightDefault)
    }

    func testWrappedPitchedIPhoneDark() throws {
        try assertScore(fixture: "son_montuno_fixture.json", trackIndex: 0, mode: .wrapped, color: .darkDefault)
    }

    func testScrollPitchedLight() throws {
        try assertScore(fixture: "son_montuno_fixture.json", trackIndex: 0, mode: .scroll, color: .lightDefault)
    }

    func testScrollPitchedDark() throws {
        try assertScore(fixture: "son_montuno_fixture.json", trackIndex: 0, mode: .scroll, color: .darkDefault)
    }

    // MARK: Percussion (Conga tumbao — 2 measures, beamed eighths)

    func testWrappedPercussionIPhoneLight() throws {
        try assertScore(fixture: "conga_tumbao_fixture.json", trackIndex: 0, mode: .wrapped, color: .lightDefault)
    }

    // MARK: Helper

    private func assertScore(
        fixture: String,
        trackIndex: Int,
        mode: StaffLayoutMode,
        color: NotationColor,
        file: StaticString = #file,
        testName: String = #function,
        line: UInt = #line
    ) throws {
        let document = try ScoreDocument.parse(CorpusFixtureLoader.data(fixture))
        let track = document.tracks[trackIndex]
        let measures = EventDescriptorBuilder.extractTrackEvents(
            track: track, initialTimeSignature: document.initialTimeSignature, keyFifths: document.initialKeyFifths
        )
        let layout = SystemLayout.layout(
            measures: measures, availableWidth: iPhoneWidth, mode: mode, scale: scale,
            startMsForQN: { ScoreTime.qnToTrackMs(track: track, score: document, qn: $0) }
        )
        let size = layout.totalSize
        XCTAssertGreaterThan(size.width, 0)
        XCTAssertGreaterThan(size.height, 0)

        let background: UIColor = color == .lightDefault ? .white : .black
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { rendererContext in
            let ctx = rendererContext.cgContext
            ctx.setFillColor(background.cgColor)
            ctx.fill(CGRect(origin: .zero, size: size))
            drawScoreLayout(layout, in: ctx, size: size, notationColor: color)
        }
        assertSnapshot(
            of: image, as: .image(precision: 0.98, perceptualPrecision: 0.97),
            file: file, testName: testName, line: line
        )
    }
}
