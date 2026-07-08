import XCTest

@testable import NotationEngraving

/// Pure math coverage for `StaffGeometry` — no font, no metadata, no CoreGraphics context.
/// Position convention (documented on `StaffGeometry` itself): 0 = bottom line, +1 = one
/// half-staff-space up, so the 5 lines sit at even positions 0/2/4/6/8 and the 4 spaces sit
/// at odd positions 1/3/5/7; positions below 0 or above 8 are off-staff and may need ledger
/// lines.
final class StaffGeometryTests: XCTestCase {
    /// origin at (0, 0), a 100pt-wide staff, 10pt staff space → lines span y 0...40.
    private let geometry = StaffGeometry(originX: 0, topLineY: 0, width: 100, staffSpace: 10)

    // MARK: Lines

    func testLineYPositionsAreEvenlySpacedTopToBottom() {
        XCTAssertEqual(geometry.lineYPositions, [0, 10, 20, 30, 40])
    }

    func testLineYPositionsScaleWithStaffSpace() {
        let bigger = StaffGeometry(originX: 0, topLineY: 5, width: 100, staffSpace: 20)
        XCTAssertEqual(bigger.lineYPositions, [5, 25, 45, 65, 85])
    }

    // MARK: y(forPosition:)

    func testTopLinePositionMatchesTopLineY() {
        XCTAssertEqual(geometry.y(forPosition: 8), 0)
    }

    func testBottomLinePositionIsFourStaffSpacesBelowTopLine() {
        XCTAssertEqual(geometry.y(forPosition: 0), 40)
    }

    func testMiddleLinePositionIsTwoStaffSpacesBelowTopLine() {
        XCTAssertEqual(geometry.y(forPosition: 4), 20)
    }

    func testSpacePositionIsHalfAStaffSpaceFromNeighboringLines() {
        // Position 1 = first space above the bottom line (between line 0 and line 2).
        XCTAssertEqual(geometry.y(forPosition: 1), 35)
        XCTAssertEqual(geometry.y(forPosition: 7), 5)
    }

    func testPositionsAboveAndBelowStaffExtrapolateLinearly() {
        // Position 10 = one full staff-space (2 half-space steps) above the top line.
        XCTAssertEqual(geometry.y(forPosition: 10), -10)
        // Position -2 = one full staff-space below the bottom line.
        XCTAssertEqual(geometry.y(forPosition: -2), 50)
    }

    // MARK: Ledger lines

    func testInStaffPositionsNeedNoLedgerLines() {
        for position in 0...8 {
            XCTAssertEqual(
                geometry.ledgerLinePositions(forPosition: position), [],
                "position \(position) is on-staff and should need no ledger lines"
            )
        }
    }

    func testSpaceImmediatelyOutsideStaffNeedsNoLedgerLine() {
        // Position 9 (space just above the top line) and -1 (space just below the bottom
        // line) don't cross any ledger line.
        XCTAssertEqual(geometry.ledgerLinePositions(forPosition: 9), [])
        XCTAssertEqual(geometry.ledgerLinePositions(forPosition: -1), [])
    }

    func testNoteOnFirstLedgerLineAboveNeedsExactlyOne() {
        XCTAssertEqual(geometry.ledgerLinePositions(forPosition: 10), [10])
    }

    func testNoteOnFirstLedgerLineBelowNeedsExactlyOne() {
        XCTAssertEqual(geometry.ledgerLinePositions(forPosition: -2), [-2])
    }

    func testNoteInSpaceBeyondFirstLedgerLineStillNeedsOnlyOne() {
        // Position 11 sits in the space above the first ledger line (10) — no line is drawn
        // through the notehead itself, but the ledger line below it (10) is still needed.
        XCTAssertEqual(geometry.ledgerLinePositions(forPosition: 11), [10])
        XCTAssertEqual(geometry.ledgerLinePositions(forPosition: -3), [-2])
    }

    func testNoteOnSecondLedgerLineNeedsBoth() {
        XCTAssertEqual(geometry.ledgerLinePositions(forPosition: 12), [10, 12])
        XCTAssertEqual(geometry.ledgerLinePositions(forPosition: -4), [-2, -4])
    }

    func testLedgerLineYPositionsMatchYForPosition() {
        XCTAssertEqual(geometry.ledgerLineYPositions(forPosition: 12), [
            geometry.y(forPosition: 10),
            geometry.y(forPosition: 12)
        ])
    }
}
