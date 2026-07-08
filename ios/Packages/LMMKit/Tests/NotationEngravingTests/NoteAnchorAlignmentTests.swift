import CoreGraphics
import Foundation
import ScoreModel
import XCTest

@testable import NotationEngraving

/// C17 anchor spot-audit: every pitched event's ``NoteAnchor`` frame must visually overlap that
/// event's notehead glyph — the invariant C18's playback cursor / click-to-seek hit-testing
/// depends on (the cursor is drawn from the anchor frame; if it didn't sit on the note, the
/// cursor would float off the note it represents). Audited across a pitched-chord doc, a
/// single-note-with-accidentals doc, and an x-notehead percussion doc so the check spans chords,
/// ledgers, accidentals, and cross noteheads.
final class NoteAnchorAlignmentTests: XCTestCase {
    private let scale = ScaleContext(staffSpacePoints: 12)

    func testMontunoChordAnchorsSitOnNoteheads() throws {
        try auditNoteheadAlignment(fixture: "son_montuno_fixture.json", trackIndex: 0)
    }

    func testGuitarLickAnchorsSitOnNoteheads() throws {
        try auditNoteheadAlignment(fixture: "guitar_lick_fixture.json", trackIndex: 0)
    }

    func testCongaTumbaoAnchorsSitOnNoteheads() throws {
        try auditNoteheadAlignment(fixture: "conga_tumbao_fixture.json", trackIndex: 0)
    }

    /// For each measure: anchors are appended in event order, so `noteAnchors[i]` belongs to
    /// `events[i]`. Every NON-rest event's anchor frame must intersect at least one notehead glyph
    /// rect in that measure (only that event's own noteheads share the anchor's narrow x-column).
    private func auditNoteheadAlignment(
        fixture: String,
        trackIndex: Int,
        file: StaticString = #file,
        line: UInt = #line
    ) throws {
        let document = try ScoreDocument.parse(CorpusFixtureLoader.data(fixture))
        let track = document.tracks[trackIndex]
        let measures = EventDescriptorBuilder.extractTrackEvents(
            track: track, initialTimeSignature: document.initialTimeSignature, keyFifths: document.initialKeyFifths
        )
        XCTAssertFalse(measures.isEmpty, "\(fixture): no measures", file: file, line: line)

        var auditedNotes = 0
        for (mIndex, descriptor) in measures.enumerated() {
            let frame = MeasureLayoutEngine.layout(
                events: descriptor.events,
                context: MeasureContext(
                    clef: descriptor.clef, timeSignature: descriptor.timeSignature,
                    showClef: mIndex == 0, showTimeSignature: mIndex == 0,
                    measureStartQN: descriptor.cumulativeQN
                ),
                origin: CGPoint(x: 40, y: scale.points(6.0)), scale: scale
            )
            XCTAssertEqual(
                frame.noteAnchors.count, descriptor.events.count,
                "\(fixture) m\(mIndex): one anchor per event", file: file, line: line
            )
            let noteheadRects = frame.noteheads.map { glyphRect($0) }

            for (eIndex, event) in descriptor.events.enumerated() where !event.isRest {
                let anchor = frame.noteAnchors[eIndex]
                let hits = noteheadRects.contains { $0.intersects(anchor.frame) }
                XCTAssertTrue(
                    hits,
                    "\(fixture) m\(mIndex) event \(eIndex): anchor \(anchor.frame) sits on no notehead",
                    file: file, line: line
                )
                auditedNotes += 1
            }
        }
        XCTAssertGreaterThan(auditedNotes, 0, "\(fixture): audited no pitched events", file: file, line: line)
    }

    /// A positioned notehead glyph's canvas-space rectangle (SMuFL bbox is staff-space, y-up,
    /// relative to the glyph origin which sits at the notehead's vertical center).
    private func glyphRect(_ glyph: PositionedGlyph) -> CGRect {
        guard let bbox = GlyphMetrics.shared.boundingBox(for: glyph.glyph) else {
            return CGRect(origin: glyph.origin, size: .zero)
        }
        return CGRect(
            x: glyph.origin.x + scale.points(bbox.swX),
            y: glyph.origin.y - scale.points(bbox.neY),
            width: scale.points(bbox.width),
            height: scale.points(bbox.height)
        )
    }
}
